'use client'

import { Sidebar } from '@/components/Sidebar'
import { ReactNode } from 'react'

export function LayoutWithSidebar({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full">
      <Sidebar />
      <main className="flex-1 lg:ml-60 w-full">
        <div className="p-6 sm:p-8 min-h-screen bg-background w-full max-w-full overflow-hidden animate-fade-slide-up">
          {children}
        </div>
      </main>
    </div>
  )
}
