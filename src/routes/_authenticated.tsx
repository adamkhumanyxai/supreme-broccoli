import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  User as UserIcon,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  Briefcase,
  MessagesSquare,
  FolderKanban,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

type NavItem = {
  to: "/dashboard" | "/jobs" | "/sessions" | "/projects" | "/profile" | "/settings";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};
const NAV_PRIMARY: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/sessions", label: "Sessions", icon: MessagesSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban },
];
const NAV_SECONDARY: NavItem[] = [
  { to: "/profile", label: "Profile", icon: UserIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function PageTitle() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/jobs": "Jobs",
    "/jobs/new": "New job",
    "/sessions": "Sessions",
    "/projects": "Projects",
    "/profile": "Profile",
    "/settings": "Settings",
    "/onboarding": "Welcome",
    "/admin/rls-test": "RLS test",
  };
  let title = map[path] ?? "";
  if (!title) {
    if (path.startsWith("/jobs/")) title = "Job";
    else if (path.startsWith("/projects/")) title = "Project";
  }
  return <h1 className="font-serif text-lg text-foreground">{title}</h1>;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const renderItem = ({ to, label, icon: Icon, exact }: NavItem) => {
    const active = exact ? path === to : path.startsWith(to);
    return (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };
  return (
    <nav className="flex flex-col gap-1">
      {NAV_PRIMARY.map(renderItem)}
      <hr className="border-border my-1" />
      {NAV_SECONDARY.map(renderItem)}
    </nav>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-border-strong">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
            {initial}
          </div>
          <span className="flex-1 truncate text-muted-foreground">{user?.email}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {user?.email}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full w-full flex-col bg-sidebar p-4">
      <div className="px-2 py-3">
        <Wordmark />
      </div>
      <div className="mt-6 flex-1">
        <NavList onNavigate={onNavigate} />
      </div>
      <UserMenu />
    </div>
  );
}

function AuthenticatedLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Apply persisted theme on every authed page load
  useTheme();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  // Onboarding gate — first-time users get sent to /onboarding
  // Cached after first check to avoid hammering the DB on every render.
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  useEffect(() => {
    if (!user || onboardingChecked) return;
    if (path === "/onboarding") return;
    let cancelled = false;
    supabase
      .from("user_settings")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        // If row missing (signup trigger race) treat as not-onboarded and redirect to safely complete the wizard.
        if (!data || !data.onboarding_completed) {
          navigate({ to: "/onboarding" });
        }
        setOnboardingChecked(true);
      })
      .catch(() => {
        if (!cancelled) setOnboardingChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, path, navigate, onboardingChecked]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 shrink-0 border-r border-border md:block">
        <Sidebar />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 border-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <PageTitle />
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
