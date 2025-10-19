import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date utilities
export function isHHMM(v: any): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

export function hhmmToMin(hhmm: string): number {
  if (!isHHMM(hhmm)) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function ymdToDate(ymd: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const [Y, M, D] = ymd.split("-").map(Number);
  return new Date(Y, (M || 1) - 1, D || 1);
}

export function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Time formatting utilities
export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "0h";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}min`;
  }
}

// GLPI status helpers
export function getStatusColor(status: number): string {
  switch (status) {
    case 1: // New
      return "bg-blue-500";
    case 2: // Processing
      return "bg-yellow-500";
    case 3: // Pending
      return "bg-orange-500";
    case 4: // Solved
      return "bg-green-500";
    case 5: // Closed
      return "bg-gray-500";
    default:
      return "bg-gray-400";
  }
}

export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1:
    case 2:
      return "text-muted-foreground";
    case 3:
      return "text-blue-500";
    case 4:
      return "text-yellow-500";
    case 5:
      return "text-orange-500";
    case 6:
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}
