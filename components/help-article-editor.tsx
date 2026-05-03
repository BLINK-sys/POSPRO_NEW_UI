"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, Loader2 } from "lucide-react"

import { TipTapEditor } from "@/components/tiptap-editor"
import { createHelpArticle, updateHelpArticle, type HelpArticle } from "@/app/actions/help-articles"

interface Props {
  mode: "create" | "edit"
  article?: HelpArticle
  onSaved?: (article: HelpArticle) => void
  onCancel?: () => void
}

export function HelpArticleEditor({ mode, article, onSaved, onCancel }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState(article?.title || "")
  const [content, setContent] = useState(article?.content || "")
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Название не может быть пустым" })
      return
    }
    startTransition(async () => {
      if (mode === "create") {
        const result = await createHelpArticle({ title, content })
        if (result) {
          toast({ title: "Инструкция создана" })
          router.push(`/admin/help/${result.id}?edit=1`)
        } else {
          toast({ variant: "destructive", title: "Не удалось создать" })
        }
      } else if (article) {
        const result = await updateHelpArticle(article.id, { title, content })
        if (result) {
          toast({ title: "Сохранено" })
          onSaved?.(result)
        } else {
          toast({ variant: "destructive", title: "Не удалось сохранить" })
        }
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          asChild
          className="rounded-full hover:bg-gray-100"
        >
          <Link href={mode === "create" ? "/admin/help" : `/admin/help/${article?.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Link>
        </Button>
      </div>

      <Card className="rounded-xl border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle>{mode === "create" ? "Новая инструкция" : "Редактирование инструкции"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Как создать товар"
              className="shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-gray-300"
            />
          </div>

          <div className="space-y-2">
            <Label>Текст инструкции</Label>
            <TipTapEditor value={content} onChange={setContent} />
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isPending}
                className="rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-shadow"
              >
                Отмена
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-lg bg-brand-yellow text-black hover:bg-yellow-500 shadow-[0_2px_6px_rgba(250,204,21,0.30)] hover:shadow-[0_6px_16px_rgba(250,204,21,0.40)] transition-shadow"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {mode === "create" ? "Создать" : "Сохранить"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
