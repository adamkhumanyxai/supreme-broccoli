import { useEffect, useRef, useState } from "react";
import type { FullProfile } from "@/routes/_authenticated/profile";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Props = {
  userId: string;
  profile: FullProfile | null;
  onChange: (patch: Partial<FullProfile>) => void;
};

export function SuperpowersCard({ userId, profile, onChange }: Props) {
  const [value, setValue] = useState(profile?.superpowers ?? "");
  const lastSaved = useRef(profile?.superpowers ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = async (text: string) => {
    if (text === lastSaved.current) return;
    const { error } = await supabase
      .from("profiles")
      .update({ superpowers: text || null })
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    lastSaved.current = text;
    onChange({ superpowers: text });
    toast.success("Saved");
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onChangeText = (v: string) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), 800);
  };

  return (
    <section className="editorial-card p-6 md:p-8">
      <h3 className="font-serif text-xl text-foreground">Your superpowers</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        What's your unfair advantage? Domain expertise, signature accomplishments, technical depth,
        network, unusual experience — anything that sets you apart and that the AI should know to
        personalize coaching for you. Bullets or prose, doesn't matter.
      </p>
      <div className="mt-6 space-y-2">
        <Label htmlFor="superpowers" className="sr-only">
          Superpowers
        </Label>
        <Textarea
          id="superpowers"
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          onBlur={() => save(value)}
          rows={8}
          className="min-h-40 resize-y"
          placeholder="• Built and scaled 3 distributed systems handling 100M+ events/day..."
        />
        <p className="text-xs text-muted-foreground">Saves automatically.</p>
      </div>
    </section>
  );
}
