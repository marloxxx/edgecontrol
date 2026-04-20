'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const STORAGE_LG = 'edgecontrol.sidebar.lgExpanded'

export type SidebarLayoutValue = {
  lgExpanded: boolean
  setLgExpanded: (value: boolean) => void
  toggleLgExpanded: () => void
  mobileDrawerOpen: boolean
  setMobileDrawerOpen: (value: boolean) => void
  toggleMobileDrawer: () => void
}

const SidebarLayoutContext = createContext<SidebarLayoutValue | null>(null)

function readLgExpandedFromStorage(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_LG) === 'true'
  } catch {
    return false
  }
}

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [lgExpanded, setLgExpandedState] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpenState] = useState(false)

  useEffect(() => {
    setLgExpandedState(readLgExpandedFromStorage())
  }, [])

  const setLgExpanded = useCallback((value: boolean) => {
    setLgExpandedState(value)
    try {
      globalThis.localStorage?.setItem(STORAGE_LG, String(value))
    } catch {
      /* ignore */
    }
  }, [])

  const toggleLgExpanded = useCallback(() => {
    setLgExpandedState((prev) => {
      const next = !prev
      try {
        globalThis.localStorage?.setItem(STORAGE_LG, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const setMobileDrawerOpen = useCallback((value: boolean) => {
    setMobileDrawerOpenState(value)
  }, [])

  const toggleMobileDrawer = useCallback(() => {
    setMobileDrawerOpenState((open) => !open)
  }, [])

  const value = useMemo(
    () => ({
      lgExpanded,
      setLgExpanded,
      toggleLgExpanded,
      mobileDrawerOpen,
      setMobileDrawerOpen,
      toggleMobileDrawer
    }),
    [lgExpanded, mobileDrawerOpen, setLgExpanded, setMobileDrawerOpen, toggleLgExpanded, toggleMobileDrawer]
  )

  return <SidebarLayoutContext.Provider value={value}>{children}</SidebarLayoutContext.Provider>
}

export function useSidebarLayout(): SidebarLayoutValue {
  const ctx = useContext(SidebarLayoutContext)
  if (!ctx) {
    throw new Error('useSidebarLayout must be used within SidebarLayoutProvider')
  }
  return ctx
}
