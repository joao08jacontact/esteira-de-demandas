// src/lib/useWorkspace.ts
import { useMemo } from "react";

/**
 * Lê o parâmetro ?ws= da URL e devolve um identificador
 * "higienizado" (minúsculas, sem espaços). Se não existir,
 * usa o fallback informado (ex.: "demo").
 */
export function useWorkspaceParam(fallback = "demo"): string {
  const search =
    typeof window !== "undefined" ? window.location.search : "";

  return useMemo(() => {
    try {
      const usp = new URLSearchParams(search);
      const raw = (usp.get("ws") || fallback).trim();
      // normaliza p/ ficar estável como chave
      return raw.toLowerCase();
    } catch {
      return fallback;
    }
  }, [search, fallback]);
}
