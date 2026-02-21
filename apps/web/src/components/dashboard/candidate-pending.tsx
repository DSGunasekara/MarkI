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
import type { SessionUser } from "@/lib/api"

type CandidatePendingProps = {
  user: SessionUser
  onSignOut: () => Promise<void>
}

export function CandidatePending({ user, onSignOut }: CandidatePendingProps) {
  return (
    <div className="min-h-screen">
      <header className="app-header w-full px-4 py-3 md:px-6 lg:px-8">
        <div className="flex w-full items-center justify-between">
          <div>
            <p className="app-overline">Hiring Engine</p>
            <p className="text-sm font-medium">Candidate Workspace</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void onSignOut()}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl items-center px-4 py-12 md:px-6 lg:px-8">
        <Card className="app-panel w-full">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Candidate account
            </Badge>
            <CardTitle>Employer dashboard is restricted</CardTitle>
            <CardDescription>
              This workspace currently exposes employer-only operations for assignment publishing and submission review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">Signed in as {user.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Switch to an employer account to manage assignments and monitor submissions.
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
