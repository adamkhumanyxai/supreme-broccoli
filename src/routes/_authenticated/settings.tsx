import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/hooks/use-theme";
import {
  getUserSettings,
  updateUserSettings,
  dataExport,
  accountDelete,
} from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Download, Loader2, Sun, Moon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl text-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize your experience and manage your data.
        </p>
      </div>
      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="privacy">Privacy &amp; Data</TabsTrigger>
          <TabsTrigger value="profile-link">Profile</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="privacy">
          <PrivacyTab />
        </TabsContent>
        <TabsContent value="profile-link">
          <ProfileLinkTab />
        </TabsContent>
        <TabsContent value="about">
          <AboutTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const update = useServerFn(updateUserSettings);

  function pickTheme(t: "dark" | "light") {
    setTheme(t);
    update({ data: { theme: t } }).catch(() => undefined);
  }

  return (
    <div className="space-y-6">
      <div className="editorial-card p-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Theme</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => pickTheme("dark")}
            className={`editorial-card flex items-center gap-3 p-4 text-left ${
              theme === "dark" ? "border-primary ring-1 ring-primary" : ""
            }`}
          >
            <Moon className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium text-foreground">Dark</p>
              <p className="text-xs text-muted-foreground">Editorial default.</p>
            </div>
          </button>
          <button
            onClick={() => pickTheme("light")}
            className={`editorial-card flex items-center gap-3 p-4 text-left ${
              theme === "light" ? "border-primary ring-1 ring-primary" : ""
            }`}
          >
            <Sun className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium text-foreground">Light</p>
              <p className="text-xs text-muted-foreground">Warm and crisp.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function PrivacyTab() {
  const { data: settings, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getUserSettings(),
  });
  const update = useServerFn(updateUserSettings);
  const exportData = useServerFn(dataExport);
  const del = useServerFn(accountDelete);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [recDays, setRecDays] = useState<number>(90);
  const [trDays, setTrDays] = useState<number>(365);
  const [emails, setEmails] = useState<boolean>(true);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setRecDays(settings.recording_retention_days);
    setTrDays(settings.transcript_retention_days);
    setEmails(settings.email_notifications);
  }, [settings]);

  async function saveRetention() {
    await update({
      data: {
        recording_retention_days: recDays,
        transcript_retention_days: trDays,
        email_notifications: emails,
      },
    });
    toast.success("Saved");
    refetch();
  }

  async function onExport() {
    setExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview-compass-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      await del({ data: { confirm_email: confirmEmail } });
      await signOut();
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="editorial-card space-y-5 p-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Retention</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Voice recordings (days)</Label>
            <Input
              type="number"
              min={7}
              max={3650}
              value={recDays}
              onChange={(e) => setRecDays(parseInt(e.target.value || "90", 10))}
            />
            <p className="text-xs text-muted-foreground">
              Recordings auto-delete after this many days.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Transcripts (days)</Label>
            <Input
              type="number"
              min={7}
              max={3650}
              value={trDays}
              onChange={(e) => setTrDays(parseInt(e.target.value || "365", 10))}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm text-foreground">Email notifications</p>
            <p className="text-xs text-muted-foreground">
              Currently unused — toggle for when we add them.
            </p>
          </div>
          <Switch checked={emails} onCheckedChange={setEmails} />
        </div>
        <div>
          <Button onClick={saveRetention}>Save retention settings</Button>
        </div>
      </div>

      <div className="editorial-card space-y-3 p-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Your data</p>
        <p className="text-sm text-muted-foreground">
          Download an archive of every piece of data we've stored for you.
        </p>
        <Button variant="outline" onClick={onExport} disabled={exporting}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download my data
        </Button>
      </div>

      <div className="editorial-card space-y-3 p-6">
        <p className="text-xs uppercase tracking-wider text-destructive">Danger zone</p>
        <p className="text-sm text-muted-foreground">
          Delete your account and all associated data. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                Type your email ({user?.email}) to confirm. We'll wipe profile, jobs, dossiers,
                sessions, projects, and stored audio.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user?.email ?? ""}
              className="my-3"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={deleting || confirmEmail !== user?.email}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete forever"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ProfileLinkTab() {
  return (
    <div className="editorial-card p-6">
      <p className="text-sm text-muted-foreground">
        Profile editing happens at{" "}
        <Link to="/profile" className="text-primary hover:underline">
          Profile
        </Link>
        .
      </p>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="editorial-card space-y-3 p-6">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">About</p>
      <p className="text-sm text-foreground">Interview Compass · v0.1</p>
      <p className="text-sm text-muted-foreground">
        Built for personal interview prep. Powered by Google Gemini via the Lovable AI Gateway, on
        Supabase + TanStack Start.
      </p>
      <Link to="/privacy" className="inline-block text-sm text-primary hover:underline">
        Privacy policy →
      </Link>
    </div>
  );
}
