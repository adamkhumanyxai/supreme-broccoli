import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { Compass, MessagesSquare, FolderKanban, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authed users to dashboard
  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 md:px-12">
        <Wordmark />
        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="outline">Sign in</Button>
          </Link>
          <Link to="/auth" onClick={() => {}}>
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-24 px-6 py-16 md:px-12 md:py-24">
        {/* Hero */}
        <section className="space-y-6">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            AI-powered interview preparation
          </p>
          <h1 className="font-serif text-5xl leading-tight text-foreground md:text-6xl">
            Walk in like<br />you've already<br />been there.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Real company intel. Live mock interviews. Take-home project support. All wired to the
            specific role you're chasing and everything that makes you good at your craft.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/auth">
              <Button size="lg" className="h-12">
                Start your prep <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={Compass}
            title="Company Insights"
            blurb="A grounded dossier on every role you're chasing — financials, leadership, recent moves, the questions they'll probe, the questions you should ask. Tailored to your domain."
          />
          <FeatureCard
            icon={MessagesSquare}
            title="Mock Interviewer"
            blurb="Run text or voice mocks with a persona that knows the company, the role, and your background. Get a brutally-honest scored debrief with concrete improvements."
          />
          <FeatureCard
            icon={FolderKanban}
            title="Project Builder"
            blurb="Got a take-home? Paste the brief, get research, an outline, and AI-drafted sections you can edit and export to PPTX, DOCX, or PDF."
          />
        </section>

        {/* How it works */}
        <section className="space-y-10">
          <div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">How it works</p>
            <h2 className="mt-3 font-serif text-3xl text-foreground">Three steps, one job offer.</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <HowItWorksStep
              number="01"
              title="Add the role"
              description="Paste a job URL or description. We extract the details and generate a tailored company dossier — financials, culture signals, the questions they'll probe, the questions you should ask."
            />
            <HowItWorksStep
              number="02"
              title="Run mock interviews"
              description="Choose your interviewer persona, difficulty, and format — text or voice. Finish and get a brutally honest scored debrief with concrete, specific improvements."
            />
            <HowItWorksStep
              number="03"
              title="Build the take-home"
              description="Got an assignment? Paste the brief. We research, outline, and draft it with you — then export to PPTX, DOCX, or PDF."
            />
          </div>
        </section>

        {/* Stats / value close-out */}
        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Built for the details</p>
            <h2 className="mt-3 font-serif text-2xl text-foreground">Everything you need. Nothing you don't.</h2>
          </div>
          <div className="editorial-card p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-3">
              <StatItem value="10" label="sections of company intel" />
              <StatItem value="7" label="dimensions scored per debrief" />
              <StatItem value="3" label="export formats — PPTX · DOCX · PDF" />
            </div>
            <div className="mt-10 flex justify-center">
              <Link to="/auth">
                <Button size="lg">Get started</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 md:px-12">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-muted-foreground">
          <span>Interview Compass</span>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  blurb,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
}) {
  return (
    <div className="editorial-card p-6">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 font-serif text-xl text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
    </div>
  );
}

function HowItWorksStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <span className="font-serif text-4xl font-semibold leading-none text-primary/40">{number}</span>
      <h3 className="font-serif text-xl text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1">
      <p className="font-serif text-4xl font-semibold text-primary">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
