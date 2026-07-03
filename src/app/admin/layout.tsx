import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";

// The real gate (Session 10): every /admin/* route renders under this
// layout, so this one check protects all of them. RLS (is_admin() on every
// admin-only write) is the final backstop even if this were somehow
// bypassed, but a non-admin should never see admin UI at all -- redirect
// before anything renders, not after.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "admin") redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
