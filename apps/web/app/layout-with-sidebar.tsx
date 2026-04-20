'use client'

import { ReactNode } from 'react'

import { Sidebar } from '@/components/Sidebar'
import { SidebarLayoutProvider, useSidebarLayout } from '@/contexts/sidebar-layout-context'
import { cn } from '@/lib/utils'

function LayoutWithSidebarInner({ children }: { children: ReactNode }) {
  const { lgExpanded, mobileDrawerOpen } = useSidebarLayout()

  return (
    <div className="flex w-full min-w-0">
      <Sidebar />
      <main
        className={cn(
          'min-w-0 flex-1 w-full transition-[padding,margin] duration-200 ease-out lg:pl-0',
          mobileDrawerOpen ? 'max-lg:pl-60' : 'max-lg:pl-12',
          lgExpanded ? 'lg:ml-60' : 'lg:ml-14'
        )}
      >
        <div className="min-w-0 p-6 sm:p-8 min-h-screen bg-background w-full max-w-full animate-fade-slide-up">{children}</div>
      </main>
    </div>
  )
}

export function LayoutWithSidebar({ children }: { children: ReactNode }) {
  return (
    <SidebarLayoutProvider>
      <LayoutWithSidebarInner>{children}</LayoutWithSidebarInner>
    </SidebarLayoutProvider>
  )
}
