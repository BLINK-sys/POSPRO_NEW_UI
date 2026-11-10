"use client"

/**
 * Страница встроенного Excel-редактора: открывает xlsx/xls/csv,
 * прикреплённые к сделкам/задачам/проектам, и даёт их править прямо в
 * браузере без скачивания.
 *
 * URL: /admin/excel/<attachment_id>
 *
 * Открывать удобнее в новой вкладке — редактор на весь экран, без
 * админского сайдбара. При «Сохранить» — PUT на тот же attachment_id,
 * вкладку можно закрыть, а исходная карточка документов перечитает
 * список сама (через refreshKey).
 */

import ExcelEditor from "@/components/excel/excel-editor"

export default function ExcelEditorPage({
  params,
}: {
  params: { attachment_id: string }
}) {
  const id = Number(params.attachment_id)
  if (Number.isNaN(id)) {
    return <div className="text-center py-24 text-gray-500">Некорректный ID</div>
  }
  return <ExcelEditor attachmentId={id} />
}
