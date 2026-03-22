'use server'

const BITRIX_WEBHOOK = "https://pospro24.bitrix24.kz/rest/4243/xpp4z3mhx0q52h6i/"
const SITE_URL = "https://pospro-new-ui.onrender.com"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://pospro-new-server.onrender.com"

// Ответственные (чередуются):
//   ID=1  - Амирхан
//   ID=11 - Алексей
const ASSIGNEES = [1, 11]

// Определяет следующего ответственного для воронки (round-robin)
// Запрашивает последнюю сделку в воронке и возвращает другого
async function getNextAssignee(categoryId: number): Promise<number> {
  try {
    const response = await fetch(`${BITRIX_WEBHOOK}crm.deal.list.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { CATEGORY_ID: categoryId },
        select: ['ID', 'ASSIGNED_BY_ID'],
        order: { ID: 'DESC' },
        start: 0,
      }),
    })
    const result = await response.json()
    const deals = result.result
    if (deals && deals.length > 0) {
      const lastAssigned = Number(deals[0].ASSIGNED_BY_ID)
      // Возвращаем другого из списка
      const nextIndex = (ASSIGNEES.indexOf(lastAssigned) + 1) % ASSIGNEES.length
      return ASSIGNEES[nextIndex]
    }
  } catch (error) {
    console.error('Bitrix24: ошибка получения последней сделки:', error)
  }
  // Если не удалось определить — первый из списка
  return ASSIGNEES[0]
}

// Воронка: Заказ с магазина (CATEGORY_ID=15)
const CATEGORY_ZAKAZ = 15
const STAGE_ZAKAZ_NEW = "C15:NEW"

// Воронка: Уточнение цены (CATEGORY_ID=17)
const CATEGORY_PRICE = 17
const STAGE_PRICE_NEW = "C17:NEW"

// Пользовательские поля Bitrix24
const FIELD_PRODUCT_NAME = "UF_CRM_1724391210918"     // Название товара (string)
const FIELD_PRODUCT_QTY = "UF_CRM_1724391265812"      // Количество товара (string)
const FIELD_PRODUCT_LINK = "UF_CRM_1773808742725"     // Ссылка на страницу в магазине (url)
const FIELD_SOURCE_ENUM = "UF_CRM_1694591054634"      // Источник... (enumeration)
const FIELD_PAYMENT_METHOD = "UF_CRM_1681388314607"   // Способ оплаты (enumeration)

// Значения enum: Источник
const SOURCE_SITE = 617  // "Сайт"

// Значения enum: Способ оплаты
const PAYMENT_MAP: Record<string, number> = {
  cash: 375,       // Наличная
  card: 381,       // Kaspi Pay
  transfer: 377,   // Безналичная
}

// Русские названия способов оплаты (для комментария)
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Картой',
  transfer: 'Банковский перевод',
}

export interface BitrixCartItem {
  product_name: string
  product_slug: string
  price: number
  quantity: number
}

export interface BitrixDealData {
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  organization_type?: string  // "individual" | "ip" | "too"
  organization_name?: string  // ИП или ТОО название
  iin?: string
  bin?: string
  payment_method?: string
  customer_comment?: string
  items: BitrixCartItem[]
  total_amount: number
}

export async function createBitrixDeal(data: BitrixDealData) {
  try {
    // Собираем данные для кастомных полей
    const productNames = data.items.map((item, i) => `${i + 1}. ${item.product_name}`).join(' | ')
    const productQty = data.items.map((item, i) => `${i + 1}. ${item.product_name}: ${item.quantity} шт`).join(' | ')

    // Контакт: имя, телефон, email через запятую
    const contactInfo = [
      data.customer_name,
      data.customer_phone,
      data.customer_email,
    ].filter(Boolean).join(', ')

    // Организация (ИП/ТОО)
    let orgLabel = ''
    if (data.organization_type === 'ip' && data.organization_name) {
      orgLabel = `ИП ${data.organization_name}`
      if (data.iin) orgLabel += ` (ИИН: ${data.iin})`
    } else if (data.organization_type === 'too' && data.organization_name) {
      orgLabel = `ТОО ${data.organization_name}`
      if (data.bin) orgLabel += ` (БИН: ${data.bin})`
    }

    // Комментарий (дублируем подробности)
    const customerInfo = [
      data.customer_name && `Клиент: ${data.customer_name}`,
      orgLabel && `Организация: ${orgLabel}`,
      data.customer_phone && `Телефон: ${data.customer_phone}`,
      data.customer_email && `Email: ${data.customer_email}`,
      data.payment_method && `Оплата: ${PAYMENT_LABELS[data.payment_method] || data.payment_method}`,
      data.customer_comment && `Комментарий: ${data.customer_comment}`,
    ].filter(Boolean).join('\n')

    const itemsList = data.items.map(
      (item) => `- ${item.product_name} (${item.quantity} шт × ${item.price.toLocaleString()} тг)\n  ${SITE_URL}/product/${item.product_slug}`
    ).join('\n')

    const comments = `${customerInfo}\n\nТовары:\n${itemsList}`

    // Заголовок сделки
    let title = ''
    if (orgLabel) {
      title = `Заказ с сайта: ${orgLabel}`
    } else if (data.customer_name) {
      title = `Заказ с сайта: ${data.customer_name}`
    } else {
      title = `Заказ с сайта: ${data.customer_phone || 'Без имени'}`
    }

    // Определяем ответственного (чередование)
    const assignedId = await getNextAssignee(CATEGORY_ZAKAZ)

    // 1. Создание сделки
    const fields: Record<string, any> = {
      TITLE: title,
      CATEGORY_ID: CATEGORY_ZAKAZ,
      STAGE_ID: STAGE_ZAKAZ_NEW,
      OPPORTUNITY: data.total_amount,
      CURRENCY_ID: "KZT",
      ASSIGNED_BY_ID: assignedId,
      SOURCE_ID: "WEB",
      COMMENTS: comments,
      // Кастомные поля
      [FIELD_PRODUCT_NAME]: productNames,
      [FIELD_PRODUCT_QTY]: productQty,
      // [FIELD_PRODUCT_LINK]: не заполняем — ссылки в комментарии
      [FIELD_SOURCE_ENUM]: SOURCE_SITE,
    }

    // Способ оплаты (если есть маппинг)
    if (data.payment_method && PAYMENT_MAP[data.payment_method]) {
      fields[FIELD_PAYMENT_METHOD] = PAYMENT_MAP[data.payment_method]
    }

    const dealResponse = await fetch(`${BITRIX_WEBHOOK}crm.deal.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FIELDS: fields,
        PARAMS: { REGISTER_SONET_EVENT: "Y" },
      }),
    })

    const dealResult = await dealResponse.json()

    if (!dealResult.result) {
      console.error('Bitrix24: ошибка создания сделки:', dealResult)
      return { success: false, message: 'Ошибка создания сделки в Bitrix24' }
    }

    const dealId = dealResult.result

    // 2. Добавление товаров в сделку (табличная часть)
    if (data.items.length > 0) {
      const rows = data.items.map((item) => ({
        PRODUCT_NAME: item.product_name,
        PRICE: item.price,
        QUANTITY: item.quantity,
      }))

      await fetch(`${BITRIX_WEBHOOK}crm.deal.productrows.set.json?id=${dealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
    }

    // Логируем заявку в нашу БД для статистики дашборда
    fetch(`${API_BASE_URL}/api/track-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_type: 'order',
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        total_amount: data.total_amount,
      }),
    }).catch(() => {})

    return { success: true, dealId }
  } catch (error) {
    console.error('Bitrix24: ошибка:', error)
    return { success: false, message: 'Ошибка отправки в Bitrix24' }
  }
}

// === Уточнение цены ===

export interface BitrixPriceInquiryData {
  customer_name?: string
  customer_phone: string
  product_name: string
  product_slug: string
}

export async function createBitrixPriceInquiry(data: BitrixPriceInquiryData) {
  try {
    const productLink = `${SITE_URL}/product/${data.product_slug}`

    const comments = [
      data.customer_name && `Клиент: ${data.customer_name}`,
      `Телефон: ${data.customer_phone}`,
      `Товар: ${data.product_name}`,
      `Ссылка: ${productLink}`,
    ].filter(Boolean).join('\n')

    const title = data.customer_name
      ? `Уточнение цены: ${data.customer_name} — ${data.product_name}`
      : `Уточнение цены: ${data.customer_phone} — ${data.product_name}`

    // Определяем ответственного (чередование)
    const assignedId = await getNextAssignee(CATEGORY_PRICE)

    const dealResponse = await fetch(`${BITRIX_WEBHOOK}crm.deal.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FIELDS: {
          TITLE: title,
          CATEGORY_ID: CATEGORY_PRICE,
          STAGE_ID: STAGE_PRICE_NEW,
          OPPORTUNITY: 0,
          CURRENCY_ID: "KZT",
          ASSIGNED_BY_ID: assignedId,
          SOURCE_ID: "WEB",
          COMMENTS: comments,
          [FIELD_PRODUCT_NAME]: data.product_name,
          [FIELD_SOURCE_ENUM]: SOURCE_SITE,
        },
        PARAMS: { REGISTER_SONET_EVENT: "Y" },
      }),
    })

    const dealResult = await dealResponse.json()

    if (!dealResult.result) {
      console.error('Bitrix24: ошибка создания запроса цены:', dealResult)
      return { success: false, message: 'Ошибка отправки запроса' }
    }

    // Логируем заявку в нашу БД для статистики дашборда
    fetch(`${API_BASE_URL}/api/track-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_type: 'price_inquiry',
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        product_name: data.product_name,
        product_slug: data.product_slug,
      }),
    }).catch(() => {})

    return { success: true, dealId: dealResult.result }
  } catch (error) {
    console.error('Bitrix24: ошибка:', error)
    return { success: false, message: 'Ошибка отправки запроса' }
  }
}
