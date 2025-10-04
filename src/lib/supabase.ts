// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON as string | undefined;

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;

export const CLOUD_ENABLED = !!supabase;

// Log pra diagnosticar no navegador (Console)
if (import.meta.env.PROD) {
  console.info('[Esteira] CLOUD_ENABLED =', CLOUD_ENABLED, 'URL =', SUPABASE_URL);
}

// Tipagem simples mapeada da tabela
export type TaskRow = {
  id: string;
  workspace: string;
  titulo: string;
  inicio: string;   // "HH:MM"
  fim: string;      // "HH:MM"
  concluida: boolean;
  rec: any;         // { kind: 'daily' | 'weekly' | 'once', ... }
  created_at: string;
};
