import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ClipboardCopyIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  dashboardApi,
  toErrorMessage,
  type EmployerSubmissionsSort
} from "@/lib/api"

const DEFAULT_LIMIT = 10

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString()
}

const assignmentsQueryKey = (params: {
  search: string
  sort: EmployerSubmissionsSort
  offset: number
}) => ["dashboard", "assignments", params] as const

export function EmployerAssignmentsList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [searchDraft, setSearchDraft] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [sort, setSort] = useState<EmployerSubmissionsSort>("newest")
  const [offset, setOffset] = useState(0)
  const [copiedJoinCode, setCopiedJoinCode] = useState<string | null>(null)

  const queryParams = useMemo(
    () => ({ search: activeSearch, sort, offset }),
    [activeSearch, sort, offset]
  )

  const {
    data: explorerData,
    error,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: assignmentsQueryKey(queryParams),
    queryFn: () =>
      dashboardApi.getAssignments({
        search: activeSearch || undefined,
        sort,
        limit: DEFAULT_LIMIT,
        offset
      })
  })

  const errorMessage = error ? toErrorMessage(error) : null

  const hasNextPage = useMemo(() => {
    if (!explorerData) {
      return false
    }

    return offset + explorerData.assignments.length < explorerData.totalAssignments
  }, [explorerData, offset])

  const handleApplyFilters = () => {
    setOffset(0)
    setActiveSearch(searchDraft)
  }

  const handleClearFilters = () => {
    setOffset(0)
    setSearchDraft("")
    setActiveSearch("")
    setSort("newest")
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["dashboard", "assignments"]
    })
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleApplyFilters()
    }
  }

  const handleCopyJoinCode = useCallback(async (joinCode: string) => {
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopiedJoinCode(joinCode)
      window.setTimeout(() => {
        setCopiedJoinCode(null)
      }, 2000)
    } catch {
      // Clipboard access denied — silently ignore
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Manage and review all your assignments in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCwIcon className={isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => void navigate({ to: "/employer/assignments/new" })}
          >
            <PlusIcon />
            Create assignment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="app-panel">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search by title or join code, and sort assignments to find what you need.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="assignments-search" className="app-overline">
              Search
            </Label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="assignments-search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="h-10 border-input bg-background pl-9"
                placeholder="Search by title or join code..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignments-sort" className="app-overline">
              Sort
            </Label>
            <Select
              value={sort}
              onValueChange={(value) => {
                setSort(value as EmployerSubmissionsSort)
                setOffset(0)
              }}
            >
              <SelectTrigger id="assignments-sort" className="h-10 w-full border-input bg-background">
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" className="h-10" onClick={handleClearFilters}>
              Clear
            </Button>
            <Button size="sm" className="h-10" onClick={handleApplyFilters}>
              Apply filters
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {explorerData ? `${explorerData.totalAssignments} matching assignment${explorerData.totalAssignments !== 1 ? "s" : ""}` : ""}
          </p>
        </CardFooter>
      </Card>

      {errorMessage ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {/* Assignment list */}
      {isLoading ? (
        <Card className="app-panel">
          <CardContent className="py-6 text-sm text-muted-foreground">Loading assignments...</CardContent>
        </Card>
      ) : explorerData && explorerData.assignments.length > 0 ? (
        <Card className="app-panel">
          <CardContent className="py-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Assignment</th>
                    <th className="px-3 py-2 font-medium">Join Code</th>
                    <th className="px-3 py-2 font-medium">Submissions</th>
                    <th className="px-3 py-2 font-medium">Latest Submission</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {explorerData.assignments.map((assignment) => (
                    <tr
                      key={assignment.id}
                      className="border-b border-border/60 align-top transition-colors hover:bg-muted/30"
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="cursor-pointer text-left font-medium text-foreground underline decoration-transparent underline-offset-2 transition hover:text-primary hover:decoration-primary"
                          onClick={() =>
                            void navigate({
                              to: "/employer/submissions",
                              search: { assignmentId: assignment.id }
                            })
                          }
                        >
                          {assignment.title}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-mono tracking-wider">
                            {assignment.joinCode}
                          </Badge>
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title="Copy join code"
                            onClick={() => void handleCopyJoinCode(assignment.joinCode)}
                          >
                            <ClipboardCopyIcon className="h-3.5 w-3.5" />
                          </button>
                          {copiedJoinCode === assignment.joinCode ? (
                            <span className="text-xs text-primary">Copied!</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {assignment.submissionCount}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDateTime(assignment.latestSubmissionAt)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDateTime(assignment.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void navigate({
                              to: "/employer/submissions",
                              search: { assignmentId: assignment.id }
                            })
                          }
                        >
                          View submissions
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="app-panel">
          <CardContent className="py-6 text-sm text-muted-foreground">
            {activeSearch.length > 0
              ? "No assignments match the current filters."
              : "No assignments yet. Create one to get started."}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      <Card className="app-panel">
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <p className="text-sm text-muted-foreground">
            Showing {explorerData?.assignments.length ?? 0} of {explorerData?.totalAssignments ?? 0}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => {
                setOffset((current) => Math.max(current - DEFAULT_LIMIT, 0))
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => {
                setOffset((current) => current + DEFAULT_LIMIT)
              }}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
