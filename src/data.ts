import { createClient } from "@supabase/supabase-js";
import { emptyStore, type Store, type Profile } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function loadRemote(): Promise<Store> {
  if (!supabase)
    throw new Error("A ligação à base de dados ainda não foi configurada.");
  const tables = [
    "profiles",
    "plans",
    "sessions",
    "messages",
    "gyms",
    "chains",
  ] as const;
  const result = emptyStore();
  await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase!.from(table).select("*");
      if (error) throw error;
      Object.assign(result, { [table]: data });
    }),
  );
  return result;
}
export async function saveRemote(
  table: Exclude<keyof Store, "profiles">,
  record: { id: string },
  isNew: boolean,
) {
  if (!supabase) throw new Error("Sem ligação à base de dados.");
  const row = record as { id: string };
  const allowed: Record<string, string[]> = {
    plans: ["name", "description", "archived", "workouts"],
    sessions: ["sets", "completed_at"],
    chains: ["status"],
  };
  const updates = Object.fromEntries(
    Object.entries(record).filter(([key]) =>
      (allowed[table] || []).includes(key),
    ),
  );
  const query = isNew
    ? supabase.from(table).insert(record)
    : supabase.from(table).update(updates).eq("id", row.id);
  const { data, error } = await query.select("id");
  if (error) throw error;
  if (!data?.length)
    throw new Error("Não tens permissão para guardar esta alteração.");
}
export async function myProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data;
}
