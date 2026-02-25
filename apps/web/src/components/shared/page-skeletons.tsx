import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                   */
/* ------------------------------------------------------------------ */

function MetricCardSkeleton() {
  return (
    <Card className="app-panel">
      <CardContent className="space-y-2 py-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-14" />
      </CardContent>
    </Card>
  )
}

function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-border/60">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-3 py-3">
          <Skeleton className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  )
}

function TableSkeleton({
  columns = 4,
  rows = 4,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="px-3 py-2 font-medium">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <TableRowSkeleton key={index} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FilterCardSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Card className="app-panel">
      <CardHeader>
        <Skeleton className="h-5 w-16" />
        <Skeleton className="mt-1 h-3 w-64" />
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
        <div className="flex items-end gap-2">
          <Skeleton className="h-10 w-16 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Page-level skeletons                                                */
/* ------------------------------------------------------------------ */

/**
 * Employer / Candidate Dashboard — metric cards + two table cards
 */
export function DashboardSkeleton({ metricCount = 6 }: { metricCount?: number }) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Metric cards */}
      <section className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-${metricCount}`}>
        {Array.from({ length: metricCount }).map((_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </section>

      {/* Table cards */}
      <Card className="app-panel">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1 h-3 w-80" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={4} rows={4} />
        </CardContent>
      </Card>

      <Card className="app-panel">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1 h-3 w-80" />
        </CardHeader>
        <CardContent>
          <TableSkeleton columns={4} rows={4} />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Assignments list — filter card + paginated table
 */
export function AssignmentsListSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
      </div>

      {/* Filter card */}
      <FilterCardSkeleton fields={2} />

      {/* Table card */}
      <Card className="app-panel">
        <CardContent className="py-0">
          <TableSkeleton columns={6} rows={5} />
        </CardContent>
      </Card>

      {/* Pagination */}
      <Card className="app-panel">
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Submissions explorer — filter card + grouped table cards + pagination
 */
export function SubmissionsExplorerSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Filter card  */}
      <Card className="app-panel">
        <CardHeader>
          <Skeleton className="h-5 w-16" />
          <Skeleton className="mt-1 h-3 w-80" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <div className="space-y-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Grouped submission cards */}
      {Array.from({ length: 2 }).map((_, index) => (
        <Card className="app-panel" key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-1 h-3 w-60" />
          </CardHeader>
          <CardContent>
            <TableSkeleton columns={9} rows={3} />
          </CardContent>
        </Card>
      ))}

      {/* Pagination */}
      <Card className="app-panel">
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Form pages (create assignment, submit repository) — header + form card
 */
export function FormPageSkeleton({ fieldCount = 2 }: { fieldCount?: number }) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 md:px-6 lg:px-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Form card */}
      <Card className="app-panel">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1 h-3 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: fieldCount }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className={`w-full rounded-md ${index === fieldCount - 1 ? "h-32" : "h-10"}`} />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-10 w-36 rounded-md" />
            <Skeleton className="h-10 w-20 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Candidate submit repository — two cards (GitHub app + form)
 */
export function SubmitRepositorySkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 md:px-6 lg:px-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      {/* GitHub App card */}
      <Card className="app-panel">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-1 h-3 w-80" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-96" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-40 rounded-md" />
            <Skeleton className="h-10 w-40 rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Submission form card */}
      <Card className="app-panel">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1 h-3 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-10 w-40 rounded-md" />
            <Skeleton className="h-10 w-20 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
