"use client"

/**
 * Страница встроенного Markdown-редактора. По аналогии с /admin/excel/<id>:
 * открывает .md-вложения сделок/задач/проектов, даёт править прямо в
 * браузере без скачивания и сохраняет PUT-ом на тот же attachment_id.
 *
 * URL: /admin/md/<attachment_id>
 */

import MdEditor from "@/components/md/md-editor"

export default function MdEditorPage({
  params,
}: {
  params: { attachment_id: string }
}) {
  const id = Number(params.attachment_id)
  if (Number.isNaN(id)) {
    return <div className="text-center py-24 text-gray-500">Некорректный ID</div>
  }
  return <MdEditor attachmentId={id} />
}
