import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AboutYouCard } from "@/components/profile/AboutYouCard";
import { ResumeCard } from "@/components/profile/ResumeCard";
import { SuperpowersCard } from "@/components/profile/SuperpowersCard";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

export type FullProfile = {
  user_id: string;
  full_name: string | null;
  headline: string | null;
  years_experience: number | null;
  domain: string | null;
  preferred_role_types: string[] | null;
  superpowers: string | null;
  resume_text: string | null;
  resume_file_url: string | null;
};

function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data as FullProfile | null);
      setLoading(false);
    })();
  }, [user]);

  if (loading || !user) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  const update = (patch: Partial<FullProfile>) =>
    setProfile((p) => (p ? { ...p, ...patch } : p));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl text-foreground">Your profile</h2>
        <p className="mt-2 text-muted-foreground">
          The AI uses everything here to personalize research, mock interviews, and prep materials.
        </p>
      </div>

      <AboutYouCard userId={user.id} profile={profile} onChange={update} />
      <ResumeCard userId={user.id} profile={profile} onChange={update} />
      <SuperpowersCard userId={user.id} profile={profile} onChange={update} />
    </div>
  );
}
