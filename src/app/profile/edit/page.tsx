"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/providers/auth-provider";
import { useUpdateProfile } from "@/hooks/use-update-profile";
import { normalizePhoneNumber } from "@/lib/contact";
import { usernameError, USERNAME_MAX_LENGTH } from "@/lib/username";
import { cn } from "@/lib/utils";

const BIO_MAX_LENGTH = 150;

// A stored international number (233XXXXXXXXX) is shown back to the user
// in the same local "0XX..." shape they'd naturally type it in, not the
// spaced "+233 XX XXX XXXX" display format that's meant for read-only
// contact buttons (see formatDisplayPhoneNumber) -- re-editing a value
// with spaces and a + in it is awkward.
function toLocalDisplayFormat(stored: string | null): string {
  if (!stored) return "";
  return stored.startsWith("233") ? `0${stored.slice(3)}` : stored;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const updateProfile = useUpdateProfile();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [usernameErrorMsg, setUsernameErrorMsg] = useState<string | undefined>(undefined);

  // Prefills once, the first time the real profile arrives -- not on
  // every profile change, or the user's own in-progress edits would get
  // clobbered the moment refreshProfile() re-runs after save.
  useEffect(() => {
    if (!profile || hasHydrated) return;
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setWhatsapp(toLocalDisplayFormat(profile.whatsappNumber));
    setPhone(toLocalDisplayFormat(profile.phoneNumber));
    setHasHydrated(true);
  }, [profile, hasHydrated]);

  if (loading) return null;
  if (!user) {
    router.push("/profile");
    return null;
  }

  function handleSave() {
    if (!user) return;

    const trimmedUsername = username.trim();
    const err = usernameError(trimmedUsername);
    if (err) {
      setUsernameErrorMsg(err);
      return;
    }
    setUsernameErrorMsg(undefined);

    updateProfile.mutate(
      {
        username: trimmedUsername || null,
        bio: bio.trim() || null,
        whatsappNumber: whatsapp.trim() ? normalizePhoneNumber(whatsapp.trim()) : null,
        phoneNumber: phone.trim() ? normalizePhoneNumber(phone.trim()) : null,
      },
      { onSuccess: () => router.push(`/profile/${user.id}`) }
    );
  }

  return (
    <div className="flex flex-col pb-8">
      <PageHeader title="Edit Profile" />

      <div className="flex flex-col gap-5 px-4 pt-4">
        <div className="flex justify-center">
          <UserAvatar username={username || null} avatarColor={profile?.avatarColor ?? null} size="lg" />
        </div>

        <Input
          label="Username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.slice(0, USERNAME_MAX_LENGTH));
            if (usernameErrorMsg) setUsernameErrorMsg(undefined);
          }}
          placeholder="Choose a username"
          error={usernameErrorMsg}
          helperText='Letters, numbers, spaces, and underscores only. Leave blank to stay as "Student".'
        />

        <div className="flex flex-col gap-1.5">
          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
            placeholder="Tell students about yourself"
            rows={3}
          />
          <span className={cn("self-end text-caption", bio.length > BIO_MAX_LENGTH - 20 ? "text-gold-600" : "text-ink-300")}>
            {bio.length}/{BIO_MAX_LENGTH}
          </span>
        </div>

        <Input
          label="WhatsApp number"
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="e.g. 0246408602"
          helperText="Other students can message you on WhatsApp"
        />

        <Input
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 0246408602"
          helperText="Other students can call you directly"
        />

        <Button variant="accent" size="lg" onClick={handleSave} loading={updateProfile.isPending} className="mt-2">
          Save
        </Button>
      </div>
    </div>
  );
}
