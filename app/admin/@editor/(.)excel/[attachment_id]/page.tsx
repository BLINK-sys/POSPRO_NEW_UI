"use client"

/**
 * Intercepting route: `(.)excel/[attachment_id]` под слотом `@editor`.
 *
 * Открывается, когда юзер делает `router.push('/admin/excel/<id>')`
 * ИЗНУТРИ любой админской страницы. Overlay-редактор рисуется поверх
 * текущей страницы (например карточки задачи), сама страница не
 * выгружается. router.back() просто убирает overlay — задача мгновенно
 * снова видна.
 *
 * Если URL открыт напрямую (закладка / копи-паста) — intercept не
 * срабатывает, используется обычный маршрут `app/admin/excel/...`.
 */

import ExcelEditor from "@/components/excel/excel-editor"

export default function InterceptedExcelEditorPage({
  params,
}: {
  params: { attachment_id: string }
}) {
  const id = Number(params.attachment_id)
  if (Number.isNaN(id)) return null
  return <ExcelEditor attachmentId={id} />
}
