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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { authApi, toErrorMessage, type UserRole } from "@/lib/api"

type AuthMode = "sign-in" | "sign-up"

type AuthPanelProps = {
  onAuthenticated: () => Promise<void>
}

export function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")

  const [signUpName, setSignUpName] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [signUpRole, setSignUpRole] = useState<UserRole>("employer")

  const onRoleChange = (value: string) => {
    setSignUpRole(value === "employer" ? "employer" : "candidate")
  }

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await authApi.signInWithEmail({
        email: signInEmail,
        password: signInPassword
      })
      await onAuthenticated()
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await authApi.signUpWithEmail({
        name: signUpName,
        email: signUpEmail,
        password: signUpPassword,
        role: signUpRole
      })
      await onAuthenticated()
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-14 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="app-panel hidden rounded-2xl p-8 lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="size-2 rounded-full bg-primary" />
            <span className="app-overline">Hiring Engine</span>
          </div>
          <h1 className="max-w-xl text-4xl leading-tight font-semibold text-foreground">
            Build and evaluate engineering candidates with production-style workflows.
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Create assignments, accept repositories, run builds, and score submissions with structured AI reports.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="app-overline">Auth</p>
            <p className="mt-1">Session cookies</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="app-overline">Runner</p>
            <p className="mt-1">Build lifecycle</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="app-overline">Reports</p>
            <p className="mt-1">AI assessment</p>
          </div>
        </div>
      </section>

      <Card className="app-panel w-full">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline">Secure Auth</Badge>
            <div className="inline-flex rounded-md border border-border bg-muted/30 p-1">
              <Button
                type="button"
                size="sm"
                variant={mode === "sign-in" ? "secondary" : "ghost"}
                onClick={() => {
                  setErrorMessage(null)
                  setMode("sign-in")
                }}
              >
                Sign in
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "sign-up" ? "secondary" : "ghost"}
                onClick={() => {
                  setErrorMessage(null)
                  setMode("sign-up")
                }}
              >
                Sign up
              </Button>
            </div>
          </div>
          <div>
            <CardTitle className="text-xl">
              {mode === "sign-in" ? "Access your dashboard" : "Create your workspace account"}
            </CardTitle>
            <CardDescription>
              {mode === "sign-in"
                ? "Use your existing credentials to continue."
                : "Choose employer to create assignments and share join codes."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {mode === "sign-in" ? (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="app-overline">
                  Email
                </Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={signInEmail}
                  onChange={(event) => setSignInEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="h-10 border-input bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password" className="app-overline">
                  Password
                </Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-10 border-input bg-background"
                />
              </div>
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              <Button className="h-10 w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Continue"}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="app-overline">
                  Full name
                </Label>
                <Input
                  id="signup-name"
                  value={signUpName}
                  onChange={(event) => setSignUpName(event.target.value)}
                  autoComplete="name"
                  required
                  className="h-10 border-input bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="app-overline">
                  Email
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signUpEmail}
                  onChange={(event) => setSignUpEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="h-10 border-input bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="app-overline">
                  Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signUpPassword}
                  onChange={(event) => setSignUpPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="h-10 border-input bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-role" className="app-overline">
                  Role
                </Label>
                <Select value={signUpRole} onValueChange={onRoleChange}>
                  <SelectTrigger id="signup-role" className="h-10 w-full border-input bg-background">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="employer">Employer</SelectItem>
                      <SelectItem value="candidate">Candidate</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              <Button className="h-10 w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter>
          <p className="text-xs text-muted-foreground">Secure cookie sessions powered by Better-Auth.</p>
        </CardFooter>
      </Card>
    </main>
  )
}
