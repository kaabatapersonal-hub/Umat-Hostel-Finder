"use client";

import { useState } from "react";
import { z } from "zod";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up" | "magic-link";

const emailSchema = z.email("Enter a valid email");
const passwordSchema = z.string().min(6, "At least 6 characters");

export interface AuthSheetProps {
  open: boolean;
  onClose: () => void;
  // Called only when a real session now exists (password sign-in/sign-up
  // with email confirmation off). Magic link and "confirm your email"
  // sign-ups can't call this synchronously — the user has to leave the app
  // and come back via /auth/callback, so any pending gated action just
  // isn't resumed automatically in that path.
  onSuccess: () => void;
}

export function AuthSheet({ open, onClose, onSuccess }: AuthSheetProps) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  function resetTransientState() {
    setErrors({});
    setFormError(null);
    setMagicLinkSent(false);
    setConfirmEmailSent(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    resetTransientState();
  }

  function handleClose() {
    setEmail("");
    setPassword("");
    resetTransientState();
    setMode("sign-in");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const emailResult = emailSchema.safeParse(email);
    const nextErrors: typeof errors = {};
    if (!emailResult.success) nextErrors.email = emailResult.error.issues[0]?.message;

    // The 6-character minimum is a sign-up-time UX nicety, not something to
    // enforce on sign-in — an existing account's real password is whatever
    // it is, and the server is the authority on whether it's correct.
    // Blocking submission client-side here would lock out real accounts.
    if (mode === "sign-up") {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) nextErrors.password = passwordResult.error.issues[0]?.message;
    } else if (mode === "sign-in" && password.length === 0) {
      nextErrors.password = "Enter your password";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "magic-link") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMagicLinkSent(true);
      } else if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If "Confirm email" is on in Supabase Auth settings, signUp()
        // succeeds but returns no session until the user clicks the
        // confirmation link — there's nothing to resume yet.
        if (data.session) {
          onSuccess();
        } else {
          setConfirmEmailSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "sign-up" ? "Create your account" : mode === "magic-link" ? "Email me a link" : "Sign in";

  return (
    <Sheet open={open} onClose={handleClose} title={title}>
      {magicLinkSent ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-body text-ink-500">
            Check <span className="font-medium text-ink-900">{email}</span> for a sign-in link. Open it on this
            device to continue.
          </p>
          <Button variant="ghost" onClick={() => switchMode("sign-in")}>
            Back
          </Button>
        </div>
      ) : confirmEmailSent ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-body text-ink-500">
            Almost there — confirm <span className="font-medium text-ink-900">{email}</span> using the link we just
            sent, then sign in.
          </p>
          <Button variant="ghost" onClick={() => switchMode("sign-in")}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-body-sm text-ink-500">
            {mode === "sign-up"
              ? "Save hostels and post reviews with a free account."
              : "Sign in to save hostels and post reviews."}
          </p>

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          {mode !== "magic-link" && (
            <Input
              label="Password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
          )}

          {formError && <p className="text-body-sm text-danger">{formError}</p>}

          <Button type="submit" variant="primary" size="lg" loading={loading}>
            {mode === "sign-up" ? "Sign Up" : mode === "magic-link" ? "Email me a link" : "Sign In"}
          </Button>

          <div className="flex flex-col items-center gap-2 pt-1 text-body-sm">
            {mode === "sign-in" && (
              <>
                <button
                  type="button"
                  onClick={() => switchMode("sign-up")}
                  className="text-brand-800 underline underline-offset-2"
                >
                  Don&apos;t have an account? Sign up
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("magic-link")}
                  className="text-ink-500 underline underline-offset-2"
                >
                  Sign in on a new device? Email me a link
                </button>
              </>
            )}
            {mode === "sign-up" && (
              <button
                type="button"
                onClick={() => switchMode("sign-in")}
                className="text-brand-800 underline underline-offset-2"
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === "magic-link" && (
              <button
                type="button"
                onClick={() => switchMode("sign-in")}
                className="text-ink-500 underline underline-offset-2"
              >
                Back to password sign-in
              </button>
            )}
          </div>
        </form>
      )}
    </Sheet>
  );
}
