import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const PARTICIPANTS_SELECT = "id,name,selected_champion_team,status,created_at,updated_at";

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("חיבור Supabase עדיין לא מוגדר. יש להוסיף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return supabaseClient;
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
