import type { KeyboardEvent, ReactNode } from "react"

import { EmptyState } from "@/components/common/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/**
 * How a column shows on phones, where each row becomes a card:
 * title (bold first line), subtitle (muted line under it), trailing (top right, for badges),
 * body (label / value pairs, default) or hide.
 */
export type MobileRole = "title" | "subtitle" | "trailing" | "body" | "hide"

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
  align?: "left" | "right" | "center"
  mobile?: MobileRole
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string | number
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: ReactNode
  emptyAction?: ReactNode
  onRowClick?: (row: T) => void
  skeletonRows?: number
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const
const CARD = "rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors"

function roleOf<T>(column: Column<T>, index: number): MobileRole {
  return column.mobile ?? (index === 0 ? "title" : "body")
}

/** Table from md up, one card per row below md. Loading shows skeletons, empty shows EmptyState. */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  emptyTitle = "Chưa có dữ liệu",
  emptyDescription,
  emptyAction,
  onRowClick,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const byRole = (role: MobileRole) => columns.filter((column, index) => roleOf(column, index) === role)
  const titles = byRole("title")
  const subtitles = byRole("subtitle")
  const trailing = byRole("trailing")
  const body = byRole("body")

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, row: T) => {
    if (onRowClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      onRowClick(row)
    }
  }

  const empty = <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />

  return (
    <>
      {/* Phones: one card per row */}
      <div className="grid gap-3 md:hidden">
        {isLoading ? (
          Array.from({ length: Math.min(skeletonRows, 4) }, (_, index) => (
            <div key={`skeleton-card-${index}`} className={CARD}>
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))
        ) : data.length === 0 ? (
          <div className={cn(CARD, "p-0")}>{empty}</div>
        ) : (
          data.map((row) => (
            <div
              key={rowKey(row)}
              className={cn(CARD, onRowClick && "cursor-pointer active:bg-muted/60")}
              {...(onRowClick
                ? { role: "button", tabIndex: 0, onClick: () => onRowClick(row), onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, row) }
                : {})}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {titles.map((column) => (
                    <div key={column.key} className="truncate font-semibold text-foreground">
                      {column.cell(row)}
                    </div>
                  ))}
                  {subtitles.map((column) => (
                    <div key={column.key} className="mt-0.5 truncate text-sm text-muted-foreground">
                      {column.cell(row)}
                    </div>
                  ))}
                </div>
                {trailing.length > 0 ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {trailing.map((column) => (
                      <div key={column.key}>{column.cell(row)}</div>
                    ))}
                  </div>
                ) : null}
              </div>
              {body.length > 0 ? (
                <dl className="mt-3 grid gap-1.5 border-t pt-3 text-sm">
                  {body.map((column) => (
                    <div key={column.key} className="flex items-center justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">{column.header}</dt>
                      <dd className="min-w-0 text-right font-medium text-foreground">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* md and up: a regular table */}
      <div className="hidden w-full overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap", ALIGN[column.align ?? "left"], column.className)}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: skeletonRows }, (_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => onKeyDown(event, row) : undefined}
                  className={cn(onRowClick && "cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none")}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn("align-middle", ALIGN[column.align ?? "left"], column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
