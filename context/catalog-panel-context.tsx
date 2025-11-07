"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

interface CatalogPanelContextType {
  isCatalogPanelOpen: boolean
  openCatalogPanel: () => void
  closeCatalogPanel: () => void
  toggleCatalogPanel: () => void
}

const CatalogPanelContext = createContext<CatalogPanelContextType | undefined>(undefined)

export function CatalogPanelProvider({ children }: { children: ReactNode }) {
  const [isCatalogPanelOpen, setIsCatalogPanelOpen] = useState(false)

  const openCatalogPanel = () => setIsCatalogPanelOpen(true)
  const closeCatalogPanel = () => setIsCatalogPanelOpen(false)
  const toggleCatalogPanel = () => setIsCatalogPanelOpen(prev => !prev)

  return (
    <CatalogPanelContext.Provider
      value={{
        isCatalogPanelOpen,
        openCatalogPanel,
        closeCatalogPanel,
        toggleCatalogPanel,
      }}
    >
      {children}
    </CatalogPanelContext.Provider>
  )
}

export function useCatalogPanel() {
  const context = useContext(CatalogPanelContext)
  if (context === undefined) {
    throw new Error("useCatalogPanel must be used within a CatalogPanelProvider")
  }
  return context
}

