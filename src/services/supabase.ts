import { createClient } from "@supabase/supabase-js";

export type ParticipantStatus = "active" | "eliminated";

export type StoredParticipant = {
  id: string;
  name: string;
  selectedChampionTeam: string;
  status: ParticipantStatus;
  createdAt: string;
  updatedAt: string;
};

type ParticipantRow = {
  id: string;
  name: string;
  selected_champion_team: string;
  status: ParticipantStatus;
  created_at: string;
  updated_at: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PARTICIPANTS_SELECT = "id,name,selected_champion_team,status,created_at,updated_at";

console.log("SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("SUPABASE KEY EXISTS:", !!import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

function getSupabaseClient() {
  if (!supabase) {
    throw new Error("חיבור Supabase עדיין לא מוגדר. יש להוסיף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.");
  }

  return supabase;
}

function logSupabaseError(action: string, error: unknown) {
  console.error(`Supabase participants ${action} failed`, error);
}

function toStoredParticipant(row: ParticipantRow): StoredParticipant {
  return {
    id: row.id,
    name: row.name,
    selectedChampionTeam: row.selected_champion_team,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchParticipants() {
  const { data, error } = await getSupabaseClient()
    .from("participants")
    .select(PARTICIPANTS_SELECT)
    .order("created_at", { ascending: true });

  if (error) {
    logSupabaseError("fetch", error);
    throw error;
  }

  return (data ?? []).map((row) => toStoredParticipant(row as ParticipantRow));
}

export async function insertParticipant(name: string, selectedChampionTeam: string) {
  const { data, error } = await getSupabaseClient()
    .from("participants")
    .insert({
      name,
      selected_champion_team: selectedChampionTeam,
      status: "active",
    })
    .select(PARTICIPANTS_SELECT)
    .single();

  if (error) {
    logSupabaseError("insert", error);
    throw error;
  }

  return toStoredParticipant(data as ParticipantRow);
}

export async function updateParticipant(
  id: string,
  updates: {
    name?: string;
    selectedChampionTeam?: string;
    status?: ParticipantStatus;
  },
) {
  const { data, error } = await getSupabaseClient()
    .from("participants")
    .update({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.selectedChampionTeam !== undefined
        ? { selected_champion_team: updates.selectedChampionTeam }
        : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(PARTICIPANTS_SELECT)
    .single();

  if (error) {
    logSupabaseError("update", error);
    throw error;
  }

  return toStoredParticipant(data as ParticipantRow);
}

export async function deleteParticipant(id: string) {
  const { error } = await getSupabaseClient()
    .from("participants")
    .delete()
    .eq("id", id);

  if (error) {
    logSupabaseError("delete", error);
    throw error;
  }
}
