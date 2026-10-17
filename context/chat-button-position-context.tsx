"use client"

/**
 * Контекст позиции плавающей кнопки чата (ChatWidget).
 *
 * По умолчанию кнопка в правом нижнем углу. На «важных» рабочих экранах
 * (внутри редактора КП, корпоративный расчётник) нижний угол занят
 * инструментарием, поэтому страница сама вызывает `setDockToHeader(true)`
 * — и кнопка плавно уезжает в правый верхний угол. При выходе со страницы
 * (unmount) эффект возвращает флаг в `false` и кнопка едет обратно вниз.
 *
 * Паковано отдельным контекстом (а не через URL), потому что часть
 * экранов — single-page (например, /kp показывает и список, и редактор в
 * зависимости от состояния, не меняя URL).
 */

import { createContext, useContext, useEffect, useState } from "react"
import type React from "react"

interface Ctx {
  dockToHeader: boolean
  setDockToHeader: (v: boolean) => void
}

const ChatButtonPositionCtx = createContext<Ctx | null>(null)

export function ChatButtonPositionProvider({ children }: { children: React.ReactNode }) {
  const [dockToHeader, setDockToHeader] = useState(false)
  return (
    <ChatButtonPositionCtx.Provider value={{ dockToHeader, setDockToHeader }}>
      {children}
    </ChatButtonPositionCtx.Provider>
  )
}

export function useChatButtonPosition(): Ctx {
  const ctx = useContext(ChatButtonPositionCtx)
  // Фолбэк — на случай если провайдер не смонтирован (виджет снаружи).
  // Не кидаем, чтобы не ронять дерево.
  return ctx ?? { dockToHeader: false, setDockToHeader: () => {} }
}

/**
 * Декларативный хелпер для страниц: монтируем на экране, где кнопка
 * должна быть сверху. При unmount автоматически возвращает её вниз.
 *
 *     if (editorMode) <DockChatButtonToHeader />
 */
export function DockChatButtonToHeader() {
  const { setDockToHeader } = useChatButtonPosition()
  useEffect(() => {
    setDockToHeader(true)
    return () => setDockToHeader(false)
  }, [setDockToHeader])
  return null
}
