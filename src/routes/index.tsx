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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 md:px-12">
        <Wordmark />
        <Link to="/auth">
          <Button variant="outline">Sign in</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 md:px-12 md:py-24">
        <section className="space-y-6">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            AI-powered interview preparation
          </p>
          <h1 className="font-serif text-5xl leading-tight text-foreground md:text-6xl">
            Walk in like<br />you've already<br />been there.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Real company intel, real-time mock interviews, real take-home help — all wired to the
            specific role you're chasing and the specific things that make you good at this.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/auth">
              <Button size="lg" className="h-12">
                Get started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
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
