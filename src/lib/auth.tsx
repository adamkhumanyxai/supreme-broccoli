import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

// Patch window.fetch once so server-fn calls forward the Supabase access token.
let fetchPatched = false;
function installAuthFetch() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      // Only attach the token to same-origin requests. Resolve against the
      // current origin so protocol-relative URLs ("//evil.com") and absolute
      // third-party URLs never receive the user's bearer token.
      let isLocal = false;
      try {
        isLocal = new URL(url, window.location.origin).origin === window.location.origin;
      } catch {
        isLocal = false;
      }
      if (isLocal) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
          return origFetch(input, { ...(init || {}), headers });
        }
      }
    } catch {
      // fall through to normal fetch
    }
    return origFetch(input, init);
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    installAuthFetch();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
