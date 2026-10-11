import { Fragment, type ReactNode } from "react"
import { Link } from "react-router"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useDocumentTitle } from "@/lib/document-title"
import { cn } from "@/lib/utils"

export interface PageBreadcrumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Buttons on the right, e.g. "Tạo lớp". */
  actions?: ReactNode
  breadcrumbs?: PageBreadcrumb[]
  /** Browser tab title when it should differ from `title` (e.g. "Tổng quan" instead of a greeting). */
  documentTitle?: string
  className?: string
}

/** Standard page title: optional breadcrumb, title, description and actions. */
export function PageHeader({ title, description, actions, breadcrumbs, documentTitle, className }: PageHeaderProps) {
  useDocumentTitle(documentTitle ?? title)
  return (
    <div className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem>
                    {crumb.to && !isLast ? (
                      <BreadcrumbLink render={<Link to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {isLast ? null : <BreadcrumbSeparator />}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {description ? <div className="max-w-2xl text-sm text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
