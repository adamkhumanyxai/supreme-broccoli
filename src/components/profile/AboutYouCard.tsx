import { useEffect, useMemo, useState } from "react";
import type { FullProfile } from "@/routes/_authenticated/profile";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOMAIN_OPTIONS, HEADLINE_PLACEHOLDERS, ROLE_SUGGESTIONS } from "@/lib/profile";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

type Props = {
  userId: string;
  profile: FullProfile | null;
  onChange: (patch: Partial<FullProfile>) => void;
};

export function AboutYouCard({ userId, profile, onChange }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [headline, setHeadline] = useState(profile?.headline ?? "");
  const [years, setYears] = useState<string>(
    profile?.years_experience != null ? String(profile.years_experience) : ""
  );
  const [domain, setDomain] = useState<string>(profile?.domain ?? "");
  const [roles, setRoles] = useState<string[]>(profile?.preferred_role_types ?? []);
  const [roleInput, setRoleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [phIdx, setPhIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % HEADLINE_PLACEHOLDERS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const suggestions = useMemo(
    () => ROLE_SUGGESTIONS.filter((r) => !roles.includes(r)).slice(0, 8),
    [roles]
  );

  const addRole = (r: string) => {
    const v = r.trim();
    if (!v || roles.includes(v)) return;
    setRoles((prev) => [...prev, v]);
    setRoleInput("");
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      full_name: fullName || null,
      headline: headline || null,
      years_experience: years ? Number(years) : null,
      domain: (domain || null) as "engineering" | "product" | "design" | "sales" | "marketing" | "operations" | "customer_success" | "data" | "finance" | "people" | "executive" | "other" | null,
      preferred_role_types: roles,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange(payload);
    toast.success("Saved");
  };

  return (
    <section className="editorial-card p-6 md:p-8">
      <h3 className="font-serif text-xl text-foreground">About you</h3>
      <p className="mt-1 text-sm text-muted-foreground">The basics, used everywhere.</p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="years">Years of experience</Label>
          <Input
            id="years"
            type="number"
            min={0}
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={HEADLINE_PLACEHOLDERS[phIdx]}
          />
        </div>
        <div className="space-y-2">
          <Label>Domain</Label>
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger>
              <SelectValue placeholder="Select your domain" />
            </SelectTrigger>
            <SelectContent>
              {DOMAIN_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Preferred role types</Label>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="pl-3 pr-1.5 py-1 gap-1">
                {r}
                <button
                  type="button"
                  onClick={() => setRoles((prev) => prev.filter((x) => x !== r))}
                  className="ml-1 inline-flex rounded-sm hover:text-foreground"
                  aria-label={`Remove ${r}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRole(roleInput);
                }
              }}
              placeholder="Add a role and press Enter"
            />
            <Button type="button" variant="outline" onClick={() => addRole(roleInput)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground py-1">Suggestions:</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addRole(s)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
