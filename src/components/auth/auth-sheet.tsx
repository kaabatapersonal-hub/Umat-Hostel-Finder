"use client";

import { useState } from "react";
import { z } from "zod";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { captureEvent } from "@/lib/analytics";
import { useToast } from "@/components/ui/toast";
import { USERNAME_MAX_LENGTH, USERNAME_PATTERN } from "@/lib/username";

const emailSchema = z.email("Enter a valid email");
// Deliberately no minimum length here -- this one field now serves both
// sign-in and sign-up, and an *existing* account's real password is
// whatever it already is (this app has real accounts shorter than 6
// characters from before any such rule existed). Blocking submission
// client-side over length would lock those accounts out of their own
// sign-in entirely. A genuinely new, too-short password still gets
// rejected -- by Supabase itself, server-side, during the signUp call
// below -- surfaced through the same friendlyErrorMessage() path as any
// other signUp error.
const passwordSchema = z.string().min(1, "Enter your password");

// Same rule as the CHECK constraint on profiles.username -- validated here
// too so a new signup gets a friendly inline error instead of a raw
// Postgres error surfacing through friendlyErrorMessage(). Only ever
// checked on the signUp path (see handleContinue) -- an existing user
// signing in never has this enforced against them.
const usernameSchema = z
  .string()
  .trim()
  .min(1, "Choose a username")
  .max(USERNAME_MAX_LENGTH, "Keep it under 30 characters")
  .regex(USERNAME_PATTERN, "Letters, numbers, spaces, and underscores only");

const DEFAULT_SUBTITLE = "Save hostels, post on Buzz, and sell on the Marketplace";

export interface AuthSheetProps {
  open: boolean;
  onClose: () => void;
  // Overrides the default value-prop subtitle -- see requireAuth's
  // `message` option in auth-provider.tsx.
  message?: string;
  // Called only when a real session now exists (password continue, or a
  // fresh signup with email confirmation off). A confirm-email-sent or
  // magic-link-sent state can't call this synchronously -- the user has
  // to leave the app and come back via /auth/callback -- so any pending
  // gated action just isn't resumed automatically in that path.
  onSuccess: () => void;
}

// Supabase has two different ways of saying "this email is already
// registered," depending on the project's Auth settings, and neither is a
// thrown error in the second case:
//  1. A real AuthError, message/code indicating the account exists.
//  2. Anti-enumeration behavior: signUp() returns 200 with NO error and a
//     user object, but `identities` is an empty array -- this is
//     Supabase's deliberate way of not confirming account existence to a
//     caller who doesn't already know the password. Checking only for a
//     thrown error would misread this as "a new account was created."
function looksLikeExistingAccount(error: { message?: string; code?: string } | null, user: { identities?: unknown[] } | null | undefined): boolean {
  if (error) {
    const message = error.message?.toLowerCase() ?? "";
    return error.code === "user_already_exists" || message.includes("already registered") || message.includes("already exists");
  }
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

function friendlyErrorMessage(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (/network|fetch/i.test(message)) return "Connection failed — check your internet and try again.";
  if (/rate limit/i.test(message)) return "Too many attempts — wait a moment and try again.";
  return message || "Something went wrong. Check your connection and try again.";
}

export function AuthSheet({ open, onClose, message, onSuccess }: AuthSheetProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; username?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);
  const { showToast } = useToast();

  function resetTransientState() {
    setErrors({});
    setFormError(null);
    setWrongPassword(false);
    setMagicLinkSent(false);
    setConfirmEmailSent(false);
  }

  function handleClose() {
    setEmail("");
    setPassword("");
    setUsername("");
    resetTransientState();
    onClose();
  }

  async function sendMagicLink() {
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setErrors((prev) => ({ ...prev, email: emailResult.error.issues[0]?.message }));
      return;
    }
    setErrors({});
    setFormError(null);
    setMagicLinkLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err) {
      setFormError(friendlyErrorMessage(err instanceof Error ? { message: err.message } : null));
    } finally {
      setMagicLinkLoading(false);
    }
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setWrongPassword(false);

    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    const nextErrors: typeof errors = {};
    if (!emailResult.success) nextErrors.email = emailResult.error.issues[0]?.message;
    if (!passwordResult.success) nextErrors.password = passwordResult.error.issues[0]?.message;
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const supabase = createClient();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        onSuccess();
        return;
      }

      // Sign-in failed -- could mean "no account with this email yet"
      // (fine, create one) or "wrong password on an existing account"
      // (not fine). signUp's own response tells them apart -- see
      // looksLikeExistingAccount. Bug fixed here: username used to be
      // validated *before* this call, blocking with "Choose a username"
      // on every wrong-password attempt against an existing account --
      // exactly the case the comment above claims never happens, because
      // signUp (the only way to actually tell the two cases apart) never
      // even ran yet. signUp is safe to call speculatively either way --
      // Supabase's anti-enumeration behavior means calling it for an
      // email that already has an account creates nothing and sends
      // nothing, it just reports back an empty identities array.
      const usernameResult = usernameSchema.safeParse(username);

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: usernameResult.success ? { username: usernameResult.data } : undefined },
      });

      if (looksLikeExistingAccount(signUpError, signUpData?.user)) {
        setWrongPassword(true);
        setFormError("Wrong password — try again or get a sign-in link below.");
        return;
      }

      if (signUpError) {
        setFormError(friendlyErrorMessage(signUpError));
        return;
      }

      // If the username was missing/invalid, the account was still just
      // created (signUp already ran) with no username set -- rare in
      // practice since the field is right there on this same form, and
      // the username nudge banner on /profile catches anyone who lands
      // here without one, same as any pre-existing account without a
      // username.
      captureEvent("signed_up");
      if (signUpData.session) {
        showToast({ message: "Welcome to Campa! 🏠", variant: "success" });
        onSuccess();
      } else {
        // "Confirm email" is on in Supabase Auth settings -- signUp
        // succeeded but there's no session until they click the
        // confirmation link. Nothing to resume yet.
        setConfirmEmailSent(true);
      }
    } catch (err) {
      setFormError(friendlyErrorMessage(err instanceof Error ? { message: err.message } : null));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Sign In / Join Campa">
      {magicLinkSent ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-body text-ink-500">
            Check <span className="font-medium text-ink-900">{email}</span> for a sign-in link. Open it on this
            device to continue.
          </p>
          <Button variant="ghost" onClick={() => resetTransientState()}>
            Back
          </Button>
        </div>
      ) : confirmEmailSent ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-body text-ink-500">
            Almost there — confirm <span className="font-medium text-ink-900">{email}</span> using the link we just
            sent, then come back and continue.
          </p>
          <Button variant="ghost" onClick={() => resetTransientState()}>
            Back
          </Button>
        </div>
      ) : (
        // noValidate -- without it, the browser's own native validation
        // tooltip for a malformed email pre-empts handleContinue entirely
        // (the submit event never fires), so the app's own styled "Enter
        // a valid email" error never gets a chance to show. This form
        // already validates everything itself.
        <form onSubmit={handleContinue} noValidate className="flex flex-col gap-4">
          <p className="text-body-sm text-ink-500">{message ?? DEFAULT_SUBTITLE}</p>

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          <PasswordInput
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />

          <Input
            label="Username"
            autoComplete="username"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            helperText="Only needed if you're creating a new account"
          />

          {formError && (
            <div className="flex flex-col gap-2 rounded-md bg-danger/10 p-3">
              <p className="text-body-sm text-danger">{formError}</p>
              {wrongPassword && (
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={magicLinkLoading}
                  className="self-start text-body-sm font-medium text-brand-800 underline underline-offset-2 disabled:opacity-50"
                >
                  {magicLinkLoading ? "Sending…" : "Send me a link"}
                </button>
              )}
            </div>
          )}

          <Button type="submit" variant="accent" size="lg" loading={loading}>
            Continue
          </Button>

          <button
            type="button"
            onClick={sendMagicLink}
            disabled={magicLinkLoading}
            className="text-center text-body-sm text-ink-500 underline underline-offset-2 disabled:opacity-50"
          >
            {magicLinkLoading ? "Sending…" : "Or sign in with email link"}
          </button>
        </form>
      )}
    </Sheet>
  );
}
