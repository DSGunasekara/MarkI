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
import { candidateApi, toErrorMessage, type SessionUser } from "@/lib/api"

type CandidateSubmitRepositoryProps = {
  user: SessionUser
  onSignOut: () => Promise<void>
  onBackToDashboard: () => void
}

export function CandidateSubmitRepository({
  user,
  onSignOut,
  onBackToDashboard
}: CandidateSubmitRepositoryProps) {
  const [joinCode, setJoinCode] = useState("")
  const [repositoryUrl, setRepositoryUrl] = useState("")
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedJoinCode = joinCode.trim().toUpperCase()
    const normalizedRepositoryUrl = repositoryUrl.trim()

    if (normalizedJoinCode.length < 4) {
      setErrorMessage("Join code is required.")
      return
    }

    if (normalizedRepositoryUrl.length === 0) {
      setErrorMessage("Repository URL is required.")
      return
    }

    setErrorMessage(null)
    setSubmitMessage(null)
    setIsSubmitting(true)

    try {
      const submissionResult = await candidateApi.submitRepository({
        joinCode: normalizedJoinCode,
        repositoryUrl: normalizedRepositoryUrl
      })

      setJoinCode("")
      setRepositoryUrl("")
      setSubmitMessage(
        submissionResult.isResubmission
          ? `Resubmitted for ${submissionResult.assignmentTitle}. Status reset to pending.`
          : `Submitted for ${submissionResult.assignmentTitle} (${submissionResult.joinCode}).`
      )
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error))
    } finally {
      setIsSubmitting(false)
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
              <p className="text-sm font-medium">Submit Repository</p>
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
            <CardTitle>Assignment Submission</CardTitle>
            <CardDescription>
              Enter your assignment join code and public GitHub repository URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmitRepository}>
              <div className="space-y-2">
                <Label htmlFor="candidate-join-code" className="app-overline">
                  Join code
                </Label>
                <Input
                  id="candidate-join-code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  className="h-10 border-input bg-background font-mono tracking-wider"
                  placeholder="AB12CD34"
                  maxLength={32}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate-repository-url" className="app-overline">
                  GitHub repository URL
                </Label>
                <Input
                  id="candidate-repository-url"
                  value={repositoryUrl}
                  onChange={(event) => setRepositoryUrl(event.target.value)}
                  className="h-10 border-input bg-background"
                  placeholder="https://github.com/username/repository"
                  required
                />
              </div>

              {submitMessage ? <p className="text-sm text-primary">{submitMessage}</p> : null}
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

              <div className="flex items-center gap-2">
                <Button type="submit" className="h-10" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit repository"}
                </Button>
                <Button type="button" variant="outline" onClick={onBackToDashboard}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              If you already submitted for this assignment, this updates your existing record and resets status to pending.
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
