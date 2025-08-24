"use client"

import React from "react"

import type { ReactNode } from "react"
import { useState } from "react"
import AdminSidebar from "@/components/admin-sidebar"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-100/40 dark:bg-gray-800/40">
      <AdminSidebar isCollapsed={isSidebarCollapsed} />
      <div className="relative flex-1">
        {/* Sticky header with toggle button */}
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-950 border-b h-14 flex items-center px-4">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-transparent"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <div className="ml-4 font-semibold text-lg">Панель администратора</div>
        </div>
        <main className={cn("p-4 md:p-6 transition-all duration-300", isSidebarCollapsed ? "ml-0" : "ml-64")}>
          {React.cloneElement(children as React.ReactElement, { isSidebarCollapsed })}
        </main>
      </div>
    </div>
  )
}
