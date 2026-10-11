import { LoaderCircle } from "lucide-react"
import type { FormEventHandler, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface FormDialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  onSubmit: FormEventHandler<HTMLFormElement>
  isSubmitting?: boolean
  submitLabel?: string
  /** Error from the last submit, shown above the buttons. */
  error?: string | null
  contentClassName?: string
}

/** Standard dialog for create / edit forms. It renders the <form> itself. */
export function FormDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Lưu",
  error,
  contentClassName,
}: FormDialogShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Do not close half-way through a save
        if (isSubmitting && !next) return
        onOpenChange(next)
      }}
    >
      <DialogContent className={cn("sm:max-w-lg", contentClassName)}>
        <form onSubmit={onSubmit} className="flex max-h-[calc(100svh-8rem)] flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Biểu mẫu {title.toLowerCase()}</DialogDescription>
            )}
          </DialogHeader>

          <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-0.5">{children}</div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
              {isSubmitting ? "Đang lưu…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
