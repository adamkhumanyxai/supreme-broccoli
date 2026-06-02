import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserSettings = {
  theme: "dark" | "light";
  accent_color: string;
  recording_retention_days: number;
  transcript_retention_days: number;
  email_notifications: boolean;
  onboarding_completed: boolean;
};

export const getUserSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      // Defensive: create on first read if trigger somehow didn't fire
      const { data: created } = await supabase
        .from("user_settings")
        .insert({ user_id: userId })
        .select("*")
        .single();
      return created as unknown as UserSettings;
    }
    return data as unknown as UserSettings;
  });

export const updateUserSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Partial<UserSettings>) =>
    z
      .object({
        theme: z.enum(["dark", "light"]).optional(),
        accent_color: z.string().optional(),
        recording_retention_days: z.number().int().min(7).max(3650).optional(),
        transcript_retention_days: z.number().int().min(7).max(3650).optional(),
        email_notifications: z.boolean().optional(),
        onboarding_completed: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_settings").update(data).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dataExport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, jobs, insights, sessions, projects, settings] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("jobs").select("*").eq("user_id", userId),
      supabase.from("insights").select("*").eq("user_id", userId),
      supabase.from("interview_sessions").select("*").eq("user_id", userId),
      supabase.from("projects").select("*").eq("user_id", userId),
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      exported_at: new Date().toISOString(),
      profile: profile.data,
      jobs: jobs.data,
      insights: insights.data,
      sessions: sessions.data,
      projects: projects.data,
      settings: settings.data,
    };
  });

export const accountDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { confirm_email: string }) =>
    z.object({ confirm_email: z.string().email() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const userEmail = (claims as { email?: string }).email;
    if (!userEmail || userEmail.toLowerCase().trim() !== data.confirm_email.toLowerCase().trim()) {
      throw new Error("Email does not match account.");
    }

    // Delete in order of FK constraints
    await supabase.from("project_artifacts").delete().eq("user_id", userId);
    await supabase.from("projects").delete().eq("user_id", userId);
    await supabase.from("interview_sessions").delete().eq("user_id", userId);
    await supabase.from("insights").delete().eq("user_id", userId);
    await supabase.from("jobs").delete().eq("user_id", userId);
    await supabase.from("companies").delete().eq("user_id", userId);
    await supabase.from("analytics_events").delete().eq("user_id", userId);
    await supabase.from("user_settings").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("user_id", userId);

    // Delete storage objects in user's folder
    const { data: files } = await supabase.storage.from("user-files").list(userId, { limit: 1000 });
    if (files && files.length) {
      await supabase.storage.from("user-files").remove(files.map((f) => `${userId}/${f.name}`));
    }
    // Subfolders (sessions/, projects/) — list & remove
    for (const sub of ["sessions", "projects"]) {
      const { data: subfiles } = await supabase.storage
        .from("user-files")
        .list(`${userId}/${sub}`, { limit: 1000 });
      if (subfiles && subfiles.length) {
        await supabase.storage
          .from("user-files")
          .remove(subfiles.map((f) => `${userId}/${sub}/${f.name}`));
      }
    }

    // Note: deleting from auth.users requires service role and is best done via Supabase admin API
    // outside the scope of this client-bound JWT. Profile + data deletion is sufficient — the next
    // sign-in trigger will recreate empty profile/settings rows if user signs back in.
    return { ok: true };
  });

export const trackEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { event_name: string; properties?: Record<string, unknown> }) =>
    z
      .object({
        event_name: z.string().min(1).max(64),
        properties: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_name: data.event_name,
      properties: (data.properties ?? {}) as unknown as never,
    });
    return { ok: true };
  });

export const getFunnelCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("analytics_events")
      .select("event_name, created_at")
      .eq("user_id", userId);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) {
      counts[r.event_name] = (counts[r.event_name] ?? 0) + 1;
    }
    return counts;
  });
