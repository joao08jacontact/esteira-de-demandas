// src/hooks/useWorkspaceParam.ts
import { useMemo } from "react";

export default function useWorkspaceParam() {
  return useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get("ws") || "demo"; // padrão "demo"
  }, []);
}
