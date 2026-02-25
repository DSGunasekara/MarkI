import { createFileRoute } from "@tanstack/react-router"

import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"

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
import { assignmentApi, toErrorMessage } from "@/lib/api"
import { FormPageSkeleton } from "@/components/shared/page-skeletons"

export const Route = createFileRoute("/_authed/employer/assignments/new")({
  pendingComponent: () => <FormPageSkeleton fieldCount={2} />,
  component: EmployerCreateAssignmentPage,
})

function EmployerCreateAssignmentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (input: { title: string; instructions: string }) =>
      assignmentApi.create(input),
    onSuccess: (assignment) => {
      setTitle("")
      setInstructions("")
      setSuccessMessage(`Assignment created. Join code: ${assignment.joinCode}`)

      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })

      navigate({ to: "/employer" })
    },
    onError: (error: unknown) => {
      setErrorMessage(toErrorMessage(error))
    }
  })

  const handleCreateAssignment = (event: FormEvent<HTMLFormElement>) => {
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

    createMutation.mutate({
      title: normalizedTitle,
      instructions: normalizedInstructions
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Create Assignment</h1>
          <p className="text-sm text-muted-foreground">Define scope and requirements so candidate evaluations stay consistent.</p>
        </div>
      </div>
      <section className="space-y-4">
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
                <Button type="submit" className="h-10" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating assignment..." : "Create assignment"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void navigate({ to: "/employer" })}>
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
      </section>
    </div>
  )
}
