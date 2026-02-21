import { useState, type FormEvent } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { assignmentApi, toErrorMessage, type SessionUser } from "@/lib/api"

type EmployerCreateAssignmentProps = {
  user: SessionUser
  onSignOut: () => Promise<void>
  onBackToDashboard: () => void
}

export function EmployerCreateAssignment({
  user,
  onSignOut,
  onBackToDashboard
}: EmployerCreateAssignmentProps) {
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleCreateAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedTitle = title.trim()
    const normalizedInstructions = instructions.trim()

    if (normalizedTitle.length < 3) {
      setErrorMessage("Title must be at least 3 characters.")
      return
    }

    if (normalizedInstructions.length < 20) {
      setErrorMessage("Instructions must be at least 20 characters.")
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsCreating(true)

    try {
      const assignment = await assignmentApi.create({
        title: normalizedTitle,
        instructions: normalizedInstructions
      })

      setTitle("")
      setInstructions("")
      setSuccessMessage(`Assignment created. Join code: ${assignment.joinCode}`)
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="app-header w-full">
        <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full bg-primary" />
            <div>
              <p className="app-overline">Hiring Engine</p>
              <p className="text-sm font-medium">Create Assignment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{user.email}</Badge>
            <Button size="sm" variant="outline" onClick={onBackToDashboard}>
              Back to dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => void onSignOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 md:px-6 lg:px-8">
        <Card className="app-panel">
          <CardHeader>
            <CardTitle>New Assignment</CardTitle>
            <CardDescription>
              Define a clear scope and deliverables so candidate evaluation stays consistent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateAssignment}>
              <div className="space-y-2">
                <Label htmlFor="assignment-title" className="app-overline">
                  Title
                </Label>
                <Input
                  id="assignment-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-10 border-input bg-background"
                  placeholder="Senior Frontend Next.js Evaluation"
                  maxLength={150}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-instructions" className="app-overline">
                  Instructions
                </Label>
                <Textarea
                  id="assignment-instructions"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  className="min-h-52 border-input bg-background"
                  placeholder="Describe requirements, constraints, expected deliverables, and quality bar."
                  maxLength={10000}
                  required
                />
              </div>

              {successMessage ? <p className="text-sm text-primary">{successMessage}</p> : null}
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

              <div className="flex items-center gap-2">
                <Button type="submit" className="h-10" disabled={isCreating}>
                  {isCreating ? "Creating assignment..." : "Create assignment"}
                </Button>
                <Button type="button" variant="outline" onClick={onBackToDashboard}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              A unique join code is generated automatically and can be shared with candidates.
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
