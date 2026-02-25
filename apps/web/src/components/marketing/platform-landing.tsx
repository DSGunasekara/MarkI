import {
  ArrowRight,
  Blocks,
  CheckCircle2,
  Gauge,
  GitCommitHorizontal,
  LayoutDashboard,
  Rocket,
  ShieldCheck,
  Sparkles
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type PlatformLandingProps = {
  onOpenAuth: () => void
  onNavigateHome?: () => void
}

const platformPillars = [
  {
    title: "Structured assignment lifecycle",
    description: "Move from assignment creation to decision-ready candidate evidence in one workflow.",
    icon: Blocks
  },
  {
    title: "Deployment-grade validation",
    description: "Each submission runs through standardized clone, install, build, and deploy steps.",
    icon: Rocket
  },
  {
    title: "Employer-grade observability",
    description: "Surface logs, run history, commit metadata, and preview links for every candidate.",
    icon: Gauge
  },
  {
    title: "Access control and traceability",
    description: "Role-aware workspaces with authenticated sessions and submission-level activity history.",
    icon: ShieldCheck
  }
]

const platformSteps = [
  {
    title: "Create assignment",
    description: "Define role expectations and generate a join code for candidate submissions.",
    icon: Sparkles
  },
  {
    title: "Collect and run submissions",
    description: "Candidates submit repositories and the platform triggers build/deploy pipeline runs.",
    icon: GitCommitHorizontal
  },
  {
    title: "Review with confidence",
    description: "Use previews, logs, and AI performance summaries to evaluate technical quality consistently.",
    icon: CheckCircle2
  }
]

export function PlatformLanding({ onOpenAuth, onNavigateHome }: PlatformLandingProps) {
  return (
    <main className="relative overflow-hidden">
      <div className="landing-orb landing-orb-primary" />
      <div className="landing-orb landing-orb-accent" />

      <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-8 sm:pt-26 sm:pb-10">
        <header className="app-panel animate-in fade-in-0 slide-in-from-top-3 fixed inset-x-0 top-0 z-50 mx-auto flex max-w-7xl items-center justify-between rounded-b-2xl border border-t-0 bg-background/80 px-5 py-4 backdrop-blur-xl duration-500 sm:top-4 sm:mx-4 sm:rounded-2xl sm:border-t lg:mx-auto">
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onOpenAuth}>
              Sign in
            </Button>
            <Button size="sm" onClick={onOpenAuth}>
              Get Started
            </Button>
          </div>
        </header>

        <section className="mt-6 grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <Badge variant="secondary" className="animate-in fade-in-0 duration-700 bg-primary/15 text-primary">
              Candidate Ops Platform
            </Badge>
            <h1 className="animate-in fade-in-0 slide-in-from-bottom-3 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl duration-700">
              A professional operating system for technical take-home evaluations.
            </h1>
            <p className="animate-in fade-in-0 slide-in-from-bottom-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base duration-700 delay-100">
              Replace fragmented review workflows with one SaaS workspace for assignment management, repository intake, deployment previews, and engineering-grade scoring context.
            </p>
            <div className="animate-in fade-in-0 slide-in-from-bottom-2 flex flex-wrap items-center gap-3 duration-700 delay-150">
              <Button className="h-11 px-5" onClick={onOpenAuth}>
                Start Workspace
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" className="h-11 px-5" onClick={onOpenAuth}>
                Sign In
              </Button>
            </div>
            <div className="animate-in fade-in-0 slide-in-from-bottom-2 grid gap-3 sm:grid-cols-3 duration-700 delay-200">
              <div className="rounded-2xl border border-border/70 bg-card/55 p-4">
                <p className="text-xl font-semibold">Faster reviews</p>
                <p className="mt-1 text-xs text-muted-foreground">Pipeline + AI summaries reduce manual triage.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/55 p-4">
                <p className="text-xl font-semibold">Consistent rubric</p>
                <p className="mt-1 text-xs text-muted-foreground">Standardized signals across all submissions.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/55 p-4">
                <p className="text-xl font-semibold">Audit ready</p>
                <p className="mt-1 text-xs text-muted-foreground">Trace every decision back to run artifacts.</p>
              </div>
            </div>
          </div>

          <Card className="app-panel animate-in fade-in-0 slide-in-from-right-4 overflow-hidden rounded-3xl border duration-700 delay-100">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutDashboard className="size-4 text-primary" />
                Platform Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                <p className="app-overline mb-2">Employer Dashboard Placeholder</p>
                <div className="space-y-2">
                  <div className="h-3 w-11/12 animate-pulse rounded bg-primary/25" />
                  <div className="h-3 w-9/12 animate-pulse rounded bg-primary/15" />
                  <div className="h-18 rounded-lg border border-border/60 bg-card/70" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                  <p className="app-overline mb-2">Submission Console</p>
                  <div className="space-y-1.5">
                    <div className="h-2 w-full animate-pulse rounded bg-chart-2/35" />
                    <div className="h-2 w-10/12 animate-pulse rounded bg-chart-2/30" />
                    <div className="h-2 w-8/12 animate-pulse rounded bg-chart-2/25" />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                  <p className="app-overline mb-2">Preview Card</p>
                  <div className="h-12 rounded-lg bg-gradient-to-br from-primary/20 to-chart-2/20" />
                  <div className="mt-2 h-2 w-7/12 rounded bg-primary/25" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8">
          <p className="app-overline mb-3">Core Platform Capabilities</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {platformPillars.map((pillar, index) => {
              const Icon = pillar.icon
              return (
                <article
                  key={pillar.title}
                  className="app-panel animate-in fade-in-0 slide-in-from-bottom-2 rounded-2xl border p-4 duration-500"
                  style={{ animationDelay: `${140 + index * 80}ms` }}
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/16 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <h2 className="mt-3 text-sm font-semibold">{pillar.title}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{pillar.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="app-panel animate-in fade-in-0 slide-in-from-left-3 rounded-2xl border duration-700 delay-150">
            <CardHeader>
              <CardTitle className="text-base">How Teams Use Codr AI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {platformSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div
                    key={step.title}
                    className="rounded-xl border border-border/70 bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                        {index + 1}
                      </span>
                      <Icon className="size-4 text-primary" />
                      <p className="text-sm font-medium">{step.title}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{step.description}</p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="app-panel animate-in fade-in-0 slide-in-from-right-3 rounded-2xl border duration-700 delay-200">
            <CardHeader>
              <CardTitle className="text-base">Preview Experience Placeholder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                <p className="app-overline mb-2">Candidate Preview Environment</p>
                <div className="h-28 rounded-xl bg-gradient-to-br from-primary/18 via-transparent to-chart-2/20" />
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                <p className="app-overline mb-2">AI Technical Report Panel</p>
                <div className="space-y-2">
                  <div className="h-2 w-10/12 rounded bg-primary/20" />
                  <div className="h-2 w-8/12 rounded bg-primary/15" />
                  <div className="h-2 w-9/12 rounded bg-primary/10" />
                  <div className="h-2 w-7/12 rounded bg-primary/10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="app-panel animate-in fade-in-0 slide-in-from-bottom-2 mt-8 rounded-2xl border px-5 py-6 text-center duration-700 delay-250">
          <p className="text-xl font-semibold tracking-tight sm:text-2xl">
            Ready to run a more consistent technical hiring process?
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Start with role-based onboarding and move from assignment setup to evidence-backed evaluations in one platform.
          </p>
          <div className="mt-4 flex justify-center">
            <Button className="h-11 px-6" onClick={onOpenAuth}>
              Launch Workspace
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
