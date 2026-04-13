'use client'

import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  itemName?: string
  description?: string
  title?: string
  cancelLabel?: string
  confirmLabel?: string
}

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  description,
  title = 'Confirm deletion',
  cancelLabel = 'Cancel',
  confirmLabel = 'Delete'
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/15">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground ml-[52px] -mt-1">
            {description
              ? description
              : itemName
                ? `Data "${itemName}" will be deleted. This action cannot be undone from the UI.`
                : 'This data will be deleted. This action cannot be undone from the UI.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
