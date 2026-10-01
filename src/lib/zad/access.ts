import type { Sql } from "@/lib/db";
import type { UserRole } from "@/lib/supabase/types";

export async function requireRole(sql: Sql, userId: string, role: UserRole) {
  const rows = await sql<{ role: UserRole }>`
    select role from profiles where id = ${userId} and is_active = true
  `;
  const current = rows[0]?.role;
  if (current !== role) throw new Error("FORBIDDEN");
  return current;
}

export async function requireTroop(sql: Sql, userId: string) {
  const rows = await sql<{ troopId: string; role: UserRole }>`
    select troop_id as "troopId", role
    from profiles
    where id = ${userId} and is_active = true and troop_id is not null
  `;
  const row = rows[0];
  if (!row) throw new Error("NO_TROOP");
  return row;
}
