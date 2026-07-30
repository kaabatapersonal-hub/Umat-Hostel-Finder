import { cn } from "@/lib/utils";

export type UserAvatarSize = "sm" | "md" | "lg";

export interface UserAvatarProps {
  // null means "Student" -- no username set yet.
  username: string | null;
  // null (no color assigned, or an anonymous post's stripped color --
  // see the migration's protect_buzz_post_writes) falls back to the same
  // neutral gray "Student" avatars use.
  avatarColor: string | null;
  size?: UserAvatarSize;
  // Forces the default "Student"/gray look even if a real username and
  // color are passed in -- used for anonymous Buzz posts, where the
  // caller may still have the author's real profile data in hand (e.g.
  // the author viewing their own profile) but must not render it.
  isAnonymous?: boolean;
  className?: string;
}

const DEFAULT_AVATAR_COLOR = "#6B7280";

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  sm: "size-8 text-body-sm",
  md: "size-10 text-body-strong",
  lg: "size-20 text-h1",
};

// The one place a Buzz/profile avatar is rendered -- a colored initial
// circle, never a photo (no upload feature exists). Used everywhere an
// author appears: post cards, reply cards, the reply sheet's pinned post
// preview, the notification panel, and both profile pages.
export function UserAvatar({ username, avatarColor, size = "md", isAnonymous = false, className }: UserAvatarProps) {
  const showDefault = isAnonymous || !username?.trim();
  const letter = showDefault ? "S" : username!.trim().charAt(0).toUpperCase();
  const backgroundColor = showDefault ? DEFAULT_AVATAR_COLOR : avatarColor || DEFAULT_AVATAR_COLOR;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white",
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor }}
    >
      {letter}
    </div>
  );
}
