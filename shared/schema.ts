import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===========================
// User Schema (Optional for future auth)
// ===========================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ===========================
// Esteira de Demandas Types (Firebase)
// ===========================
export type RecKind = "once" | "daily" | "weekly";

export const taskSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  inicio: z.string(), // HH:MM
  fim: z.string(), // HH:MM
  concluida: z.boolean(),
  responsavel: z.string(),
  operacao: z.string(),
  ymd: z.string(), // YYYY-MM-DD
  seriesId: z.string().optional(),
  recKind: z.enum(["once", "daily", "weekly"]).optional(),
  workspaceId: z.string(),
  createdAt: z.number(),
});

export type Task = z.infer<typeof taskSchema>;

export const insertTaskSchema = taskSchema.omit({ id: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;

// Constantes para Esteira de Demandas
export const RESPONSAVEIS = ["Bárbara Arruda", "Gabriel Bion", "Luciano Miranda"];

export const OPERACOES = [
  "FMU",
  "INSPIRALI",
  "COGNA",
  "SINGULARIDADES",
  "PÓS COGNA",
  "UFEM",
  "TELECOM",
  "FGTS",
  "DIROMA",
  "ESTÁCIO",
];

// ===========================
// DashRealtime Types (GLPI)
// ===========================

// GLPI Ticket Schema based on API structure
export const glpiTicketSchema = z.object({
  id: z.number(),
  name: z.string(),
  content: z.string().optional(),
  status: z.number(), // 1=New, 2=Processing, 3=Pending, 4=Solved, 5=Closed
  urgency: z.number(), // 1-5
  impact: z.number(), // 1-5
  priority: z.number(), // 1-6
  type: z.number(), // 1=Incident, 2=Request
  date: z.string(),
  date_mod: z.string(),
  entities_id: z.number(),
  itilcategories_id: z.number().optional(),
  users_id_recipient: z.number().optional(),
  locations_id: z.number().optional(),
  requesttypes_id: z.number().optional(),
  
  // Assignment fields
  users_id_assign: z.number().optional(),
  groups_id_assign: z.number().optional(),
  users_id_lastupdater: z.number().optional(),
  
  // Date fields for time tracking
  closedate: z.string().nullable().optional(),
  solvedate: z.string().nullable().optional(),
  time_to_resolve: z.string().nullable().optional(),
  time_to_own: z.string().nullable().optional(),
  begin_waiting_date: z.string().nullable().optional(),
  
  // Time metrics (in seconds)
  waiting_duration: z.number().optional(),
  actiontime: z.number().optional(),
  takeintoaccount_delay_stat: z.number().optional(),
  solve_delay_stat: z.number().optional(),
  close_delay_stat: z.number().optional(),
  
  // SLA/OLA fields
  slas_id_ttr: z.number().optional(),
  slas_id_tto: z.number().optional(),
  olas_id_ttr: z.number().optional(),
  olas_id_tto: z.number().optional(),
  
  // Validation
  global_validation: z.number().optional(),
});

export type GlpiTicket = z.infer<typeof glpiTicketSchema>;

// Filter schema
export const ticketFiltersSchema = z.object({
  status: z.array(z.number()).optional(),
  priority: z.array(z.number()).optional(),
  category: z.array(z.number()).optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  type: z.array(z.number()).optional(),
  assignedTo: z.array(z.number()).optional(),
  assignedGroup: z.array(z.number()).optional(),
});

export type TicketFilters = z.infer<typeof ticketFiltersSchema>;

// Stats schema for KPI cards
export const ticketStatsSchema = z.object({
  total: z.number(),
  new: z.number(),
  inProgress: z.number(),
  pending: z.number(),
  solved: z.number(),
  closed: z.number(),
  
  // Time-based metrics
  avgResolutionTime: z.number().optional(),
  avgFirstResponseTime: z.number().optional(),
  avgWaitingTime: z.number().optional(),
  ticketsInWaiting: z.number().optional(),
  
  // SLA metrics
  slaCompliance: z.number().optional(),
  slaViolations: z.number().optional(),
  
  byStatus: z.array(z.object({
    status: z.number(),
    count: z.number(),
  })),
  byPriority: z.array(z.object({
    priority: z.number(),
    count: z.number(),
  })),
  byType: z.array(z.object({
    type: z.number(),
    count: z.number(),
  })),
  byAssignee: z.array(z.object({
    userId: z.number(),
    userName: z.string(),
    count: z.number(),
  })).optional(),
  byGroup: z.array(z.object({
    groupId: z.number(),
    groupName: z.string(),
    count: z.number(),
  })).optional(),
  resolutionTimeDistribution: z.array(z.object({
    range: z.string(),
    count: z.number(),
  })).optional(),
  timeline: z.array(z.object({
    date: z.string(),
    count: z.number(),
  })),
  weeklyTimeline: z.array(z.object({
    weekLabel: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    count: z.number(),
  })).optional(),
});

export type TicketStats = z.infer<typeof ticketStatsSchema>;

// GLPI Status mapping
export const GLPI_STATUS = {
  1: "Novo",
  2: "Em Processamento",
  3: "Pendente",
  4: "Resolvido",
  5: "Fechado",
  6: "Cancelado",
} as const;

// GLPI Priority mapping
export const GLPI_PRIORITY = {
  1: "Muito Baixa",
  2: "Baixa",
  3: "Média",
  4: "Alta",
  5: "Muito Alta",
  6: "Urgente",
} as const;

// GLPI Type mapping
export const GLPI_TYPE = {
  1: "Incidente",
  2: "Requisição",
} as const;
