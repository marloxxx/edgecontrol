'use client'

import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { Card } from '@/components/ui/card'

export default function History() {
  return (
    <LayoutWithSidebar>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">History</h1>
          <p className="text-muted-foreground mt-2">View historical logs and events</p>
        </div>

        <Card className="border-border bg-card p-12 text-center">
          <p className="text-foreground text-lg font-semibold">History Coming Soon</p>
          <p className="text-muted-foreground mt-2">Complete audit trail will be available here</p>
        </Card>
      </div>
    </LayoutWithSidebar>
  )
}
