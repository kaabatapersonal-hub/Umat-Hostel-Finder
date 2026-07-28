"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRole, AdminPermission } from "@/lib/supabase/database.types";
import { AuthSheet } from "@/components/auth/auth-sheet";
import { identifyUser, resetIdentity } from "@/lib/analytics";

export interface Profile {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: ProfileRole;
  isVerified: boolean;
  verificationLabel: string | null;
  // Only ever meaningful when role === 'admin' -- a student's row always
  // has isSuperAdmin=false, adminPermissions=[]. See admin-shell.tsx for
  // how these gate which admin tabs render.
  isSuperAdmin: boolean;
  adminPermissions: AdminPermission[];
}

interface RequireAuthOptions {
  // Overrides the sheet's default value-prop subtitle with something
  // specific to whatever gated the user just now (Buzz's "Join Campa to
  // post on Buzz...", the save heart's "Join Campa to save this
  // hostel..."). Falls back to the generic subtitle when omitted.
  message?: string;
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
  requireAuth: (action: () => void, options?: RequireAuthOptions) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMessage, setSheetMessage] = useState<string | undefined>(undefined);
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

  // Keyed on `user` alone, not profile -- identity should attach the
  // moment a session exists, not wait on the profile row round trip.
  // Covers sign-in, session restore on load, and sign-out (reset) all in
  // one place, rather than threading this through every call site that
  // changes auth state.
  useEffect(() => {
    if (user) {
      identifyUser(user.id, { email: user.email });
    } else {
      resetIdentity();
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, is_suspended, is_verified, verification_label, is_super_admin, admin_permissions")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.is_suspended) {
          // The real backstop is server-side (a suspended account's own
          // review/submission inserts are rejected by RLS regardless of
          // this check) -- this is just the client-side kick-out so a
          // suspended session doesn't keep browsing as if nothing happened.
          supabase.auth.signOut();
          setProfile(null);
          return;
        }
        setProfile(
          data
            ? {
                id: data.id,
                fullName: data.full_name,
                email: data.email,
                avatarUrl: data.avatar_url,
                role: (data.role as ProfileRole) ?? "student",
                isVerified: data.is_verified,
                verificationLabel: data.verification_label,
                isSuperAdmin: data.is_super_admin,
                adminPermissions: Array.isArray(data.admin_permissions) ? (data.admin_permissions as AdminPermission[]) : [],
              }
            : null
        );
      });
  }, [user]);

  function requireAuth(action: () => void, options?: RequireAuthOptions) {
    if (user) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setSheetMessage(options?.message);
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
        message={sheetMessage}
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
