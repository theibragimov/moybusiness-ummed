import "server-only";
import { createClient } from "@supabase/supabase-js";

export type DebtDirection = "theyOweUs" | "weOweThem";

export interface ManualDebt {
  id: string;
  direction: DebtDirection;
  name: string;
  amount: number; // in so'm, not MoySklad's x100 minor unit
  createdAt: string;
  updatedAt: string;
}

interface ManualDebtRow {
  id: string;
  direction: DebtDirection;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY is not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function fromRow(r: ManualDebtRow): ManualDebt {
  return {
    id: r.id,
    direction: r.direction,
    name: r.name,
    amount: Number(r.amount),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listManualDebts(): Promise<ManualDebt[]> {
  const { data, error } = await client()
    .from("manual_debts")
    .select("*")
    .order("amount", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ManualDebtRow[]).map(fromRow);
}

export async function addManualDebt(input: {
  direction: DebtDirection;
  name: string;
  amount: number;
}): Promise<ManualDebt> {
  const { data, error } = await client().from("manual_debts").insert(input).select().single();
  if (error) throw new Error(error.message);
  return fromRow(data as ManualDebtRow);
}

export async function updateManualDebt(id: string, input: { name: string; amount: number }): Promise<void> {
  const { error } = await client()
    .from("manual_debts")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteManualDebt(id: string): Promise<void> {
  const { error } = await client().from("manual_debts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
