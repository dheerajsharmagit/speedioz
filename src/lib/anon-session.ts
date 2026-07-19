// Ensures a Supabase (anonymous) auth session exists so RLS policies scoped to
// auth.uid() can identify the rider/captain even without full sign-in.
import { supabase } from "@/integrations/supabase/client";

let pending: Promise<string> | null = null;

export async function ensureAnonSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user?.id) return data.session.user.id;
  if (pending) return pending;
  pending = (async () => {
    const { data: signed, error } = await supabase.auth.signInAnonymously();
    if (error || !signed.user) throw error ?? new Error("Anonymous sign-in failed");
    return signed.user.id;
  })().finally(() => { pending = null; });
  return pending;
}
