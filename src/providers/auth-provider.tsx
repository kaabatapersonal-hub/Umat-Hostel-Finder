"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/supabase/database.types";
import { AuthSheet } from "@/components/auth/auth-sheet";

export interface Profile {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: ProfileRole;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  // Browsing and contact are never gated. This is the one chokepoint gated
  // actions (Save today, Reviews next session) call through: run `action`
  // immediately if signed in, otherwise open the sheet and remember it, so
  // it resumes automatically the moment sign-in succeeds — the user never
  // has to repeat the tap that got them here.
  requireAuth: (action: () => void) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(
          data
            ? {
                id: data.id,
                fullName: data.full_name,
                email: data.email,
                avatarUrl: data.avatar_url,
                role: (data.role as ProfileRole) ?? "student",
              }
            : null
        );
      });
  }, [user]);

  function requireAuth(action: () => void) {
    if (user) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setIsSheetOpen(true);
  }

  function handleAuthSuccess() {
    setIsSheetOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (!action) return;
    // Give the onAuthStateChange listener's setUser() a tick to actually
    // commit before the resumed action reads `user` from context — it
    // fires effectively synchronously with the sign-in call resolving, but
    // isn't guaranteed to have flushed to a re-render yet at this exact
    // point. Mutations that need the user id still re-fetch it fresh
    // themselves (see useToggleSave) as the real safety net; this just
    // makes the optimistic UI update land correctly too.
    queueMicrotask(action);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, requireAuth, signOut }}>
      {children}
      <AuthSheet
        open={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          pendingActionRef.current = null;
        }}
        onSuccess={handleAuthSuccess}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
