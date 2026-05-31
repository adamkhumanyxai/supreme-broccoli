import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

// Sign-up is open. Add a whitelist check here later if you want to gate it.

type Mode = "signin" | "signup" | "reset" | "update";

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // The reset email links back here with `?mode=recovery`. Supabase establishes
  // a short-lived recovery session from the URL, so we switch to the "set a new
  // password" view instead of bouncing to the dashboard.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "recovery") {
      setRecovering(true);
      setMode("update");
    }
  }, []);

  useEffect(() => {
    if (!loading && session && !recovering) navigate({ to: "/dashboard" });
  }, [session, loading, recovering, navigate]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword("");
  };

  const emailShown = mode !== "update";
  const passwordShown = mode !== "reset";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailShown && !email) return;
    if (passwordShown && !password) return;

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        toast.success("Account created. Signing you in…");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth?mode=recovery",
        });
        if (error) throw error;
        toast.success("Check your email for a password reset link.");
        switchMode("signin");
      } else if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Create account"
        : mode === "reset"
          ? "Reset password"
          : "Set a new password";

  const description =
    mode === "signin"
      ? "Use your email and password to continue."
      : mode === "signup"
        ? "Create an account with email and password."
        : mode === "reset"
          ? "Enter your email and we'll send you a reset link."
          : "Choose a new password for your account.";

  const buttonLabel = submitting
    ? {
        signin: "Signing in…",
        signup: "Creating account…",
        reset: "Sending…",
        update: "Updating…",
      }[mode]
    : {
        signin: "Sign in",
        signup: "Create account",
        reset: "Send reset link",
        update: "Update password",
      }[mode];

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Wordmark className="text-2xl" />
        </div>
        <div className="editorial-card p-8">
          <h1 className="font-serif text-2xl text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {emailShown && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-11"
                />
              </div>
            )}
            {passwordShown && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
                    {mode === "update" ? "New password" : "Password"}
                  </Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus={mode === "update"}
                  className="h-11"
                />
              </div>
            )}
            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {buttonLabel}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" && (
              <>
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-primary hover:underline"
                >
                  Sign up
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
            {(mode === "reset" || mode === "update") && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-primary hover:underline"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
