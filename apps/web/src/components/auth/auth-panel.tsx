import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { Rocket } from "lucide-react"

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
  onNavigateHome?: () => void
}



export function AuthPanel({ onAuthenticated, onNavigateHome }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in")
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

  const signInMutation = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      await authApi.signInWithEmail(input)
      await onAuthenticated()
    },
    onError: (error: unknown) => {
      setErrorMessage(toErrorMessage(error))
    }
  })

  const signUpMutation = useMutation({
    mutationFn: async (input: { name: string; email: string; password: string; role: UserRole }) => {
      await authApi.signUpWithEmail(input)
      await onAuthenticated()
    },
    onError: (error: unknown) => {
      setErrorMessage(toErrorMessage(error))
    }
  })

  const isSubmitting = signInMutation.isPending || signUpMutation.isPending

  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    signInMutation.mutate({
      email: signInEmail,
      password: signInPassword
    })
  }

  const handleSignUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    signUpMutation.mutate({
      name: signUpName,
      email: signUpEmail,
      password: signUpPassword,
      role: signUpRole
    })
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="landing-orb landing-orb-primary" />
      <div className="landing-orb landing-orb-accent" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center px-4 pt-24 pb-8 sm:pt-28 sm:pb-10">
        <header className="app-panel animate-in fade-in-0 slide-in-from-top-2 fixed inset-x-0 top-0 z-50 mx-auto flex max-w-7xl items-center justify-between rounded-b-2xl border border-t-0 bg-background/80 px-5 py-4 backdrop-blur-xl duration-500 sm:top-4 sm:mx-4 sm:rounded-2xl sm:border-t lg:mx-auto">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
            onClick={onNavigateHome}
          >
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Rocket className="size-4" />
            </span>
            <div className="text-left">
              <p className="text-sm font-medium">Codr AI</p>
              <p className="app-overline">Candidate Evaluation Platform</p>
            </div>
          </button>
        </header>

        <div className="flex w-full flex-1 items-center justify-center">
          <Card className="app-panel animate-in fade-in-0 slide-in-from-bottom-3 w-full max-w-lg rounded-3xl border duration-500">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-muted/35">
                  Workspace Access
                </Badge>
                <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
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
                <CardTitle className="text-2xl tracking-tight">
                  {mode === "sign-in" ? "Welcome back" : "Create your workspace account"}
                </CardTitle>
                <CardDescription className="mt-1">
                  {mode === "sign-in"
                    ? "Sign in to continue managing assignments, submissions, and hiring decisions."
                    : "Choose your role to configure the correct workspace experience."}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              {mode === "sign-in" ? (
                <form className="space-y-4" onSubmit={handleSignIn}>
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="app-overline">
                      Work email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={signInEmail}
                      onChange={(event) => setSignInEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="you@company.com"
                      required
                      className="h-11 border-input bg-background"
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
                      placeholder="Enter your password"
                      required
                      className="h-11 border-input bg-background"
                    />
                  </div>
                  {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                  <Button className="h-11 w-full" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Signing in..." : "Access workspace"}
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
                      placeholder="Alex Morgan"
                      required
                      className="h-11 border-input bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="app-overline">
                      Work email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signUpEmail}
                      onChange={(event) => setSignUpEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="you@company.com"
                      required
                      className="h-11 border-input bg-background"
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
                      placeholder="Minimum 8 characters"
                      required
                      className="h-11 border-input bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-role" className="app-overline">
                      Workspace role
                    </Label>
                    <Select value={signUpRole} onValueChange={onRoleChange}>
                      <SelectTrigger id="signup-role" className="h-11 w-full border-input bg-background">
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
                  <Button className="h-11 w-full" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating account..." : "Create workspace account"}
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="border-t border-border/70 pt-5">
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Preview infrastructure, build logs, and AI reporting are scoped to authenticated workspaces.</p>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  )
}
