import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { profileCompleteness, type ProfileRow } from "@/lib/profile";
import { ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, headline, superpowers, resume_file_url, domain")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [user]);

  const pct = profileCompleteness(profile);
  const name = profile?.full_name?.trim().split(" ")[0] || "there";

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h2 className="mt-1 font-serif text-3xl text-foreground md:text-4xl">
          Hello, {name}.
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Add your first job to start building company insights, mock interviews, and a tailored
          presentation.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => navigate({ to: "/jobs/new" })} className="h-11">
          <Plus className="mr-2 h-4 w-4" /> New job
        </Button>
        <Button size="lg" variant="outline" onClick={() => navigate({ to: "/jobs" })} className="h-11">
          View all jobs
        </Button>
        <Button size="lg" variant="outline" onClick={() => navigate({ to: "/sessions" })} className="h-11">
          Mock sessions
        </Button>
        <Button size="lg" variant="outline" onClick={() => navigate({ to: "/projects" })} className="h-11">
          Projects
        </Button>
      </div>

      <Link to="/profile" className="editorial-card block p-6 group">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Profile</p>
            <h3 className="mt-2 font-serif text-xl text-foreground">
              Profile completeness: {loading ? "…" : `${pct}%`}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The more we know about you, the more personalized your prep becomes.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
        <Progress value={pct} className="mt-5 h-1.5" />
      </Link>
    </div>
  );
}
