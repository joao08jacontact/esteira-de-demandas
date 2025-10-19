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
  closeDateFrom: z.string().optional(),
  closeDateTo: z.string().optional(),
  type: z.array(z.number()).optional(),
  assignedTo: z.array(z.number()).optional(),
  assignedGroup: z.array(z.number()).optional(),
  name: z.string().optional(),
  users_id_recipient: z.array(z.number()).optional(),
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
  
  // Time-based metrics (all in seconds, to be formatted as HH:MM:SS on frontend)
  avgCloseDelay: z.number().optional(),
  avgSolveDelay: z.number().optional(),
  avgTakeIntoAccountDelay: z.number().optional(),
  avgWaitingDuration: z.number().optional(),
  
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
  byCategory: z.array(z.object({
    categoryId: z.number(),
    categoryName: z.string(),
    count: z.number(),
  })).optional(),
  topRequesters: z.array(z.object({
    userId: z.number(),
    userName: z.string(),
    count: z.number(),
  })).optional(),
  timeline: z.array(z.object({
    date: z.string(),
    count: z.number(),
  })),
  timelineComparison: z.array(z.object({
    date: z.string(),
    opened: z.number(),
    closed: z.number(),
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

// ===========================
// BI Cadastro Module
// ===========================

// Tabela de BIs
export const bis = pgTable("bis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  dataInicio: text("data_inicio").notNull(),
  dataFinal: text("data_final").notNull(),
  responsavel: text("responsavel").notNull(),
  operacao: text("operacao").notNull(),
  status: text("status").notNull().default("em_aberto"), // em_aberto, concluido
  inativo: boolean("inativo").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tabela de Bases de Origem
export const basesOrigem = pgTable("bases_origem", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  biId: varchar("bi_id").notNull(),
  nomeFerramenta: text("nome_ferramenta").notNull(),
  pastaOrigem: text("pasta_origem").notNull(),
  temApi: boolean("tem_api").notNull().default(false),
  status: text("status").notNull().default("aguardando"), // aguardando, em_andamento, pendente, concluido
  observacao: text("observacao"),
});

// Tabela de Elementos do Canvas (Nodes)
export const canvasNodes = pgTable("canvas_nodes", {
  id: varchar("id").primaryKey(),
  type: text("type").notNull().default("default"),
  positionX: text("position_x").notNull(),
  positionY: text("position_y").notNull(),
  data: text("data").notNull(), // JSON string com {label, content, nodeType}
  width: text("width"),
  height: text("height"),
});

// Tabela de Conexões do Canvas (Edges)
export const canvasEdges = pgTable("canvas_edges", {
  id: varchar("id").primaryKey(),
  source: text("source").notNull(),
  target: text("target").notNull(),
  type: text("type").notNull().default("smoothstep"),
  animated: boolean("animated").notNull().default(false),
});

// Insert Schemas
export const insertBiSchema = createInsertSchema(bis).omit({
  id: true,
  status: true,
  inativo: true,
  createdAt: true,
});

export const insertBaseOrigemSchema = createInsertSchema(basesOrigem).omit({
  id: true,
});

export const insertCanvasNodeSchema = createInsertSchema(canvasNodes);

export const insertCanvasEdgeSchema = createInsertSchema(canvasEdges);

// Update Schemas
export const updateBaseOrigemStatusSchema = z.object({
  status: z.enum(["aguardando", "em_andamento", "pendente", "concluido"]),
  observacao: z.string().optional(),
});

export const updateBiInativoSchema = z.object({
  inativo: z.boolean(),
});

// Types
export type InsertBi = z.infer<typeof insertBiSchema>;
export type Bi = typeof bis.$inferSelect;

export type InsertBaseOrigem = z.infer<typeof insertBaseOrigemSchema>;
export type BaseOrigem = typeof basesOrigem.$inferSelect;

export type InsertCanvasNode = z.infer<typeof insertCanvasNodeSchema>;
export type CanvasNode = typeof canvasNodes.$inferSelect;

export type InsertCanvasEdge = z.infer<typeof insertCanvasEdgeSchema>;
export type CanvasEdge = typeof canvasEdges.$inferSelect;

// Extended Types for Frontend
export type BiWithBases = Bi & {
  bases: BaseOrigem[];
};

// ===========================
// Automação Module
// ===========================

// Constantes para recorrência
export const RECORRENCIAS = [
  "Uma vez",
  "Diário",
  "Semanal",
  "Mensalmente",
] as const;

// Tabela de Automações
export const automacoes = pgTable("automacoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nomeIntegracao: text("nome_integracao").notNull(),
  recorrencia: text("recorrencia").notNull(),
  dataHora: text("data_hora").notNull(),
  repetirUmaHora: boolean("repetir_uma_hora").notNull().default(false),
  nomeExecutavel: text("nome_executavel").notNull(),
  pastaFimAtualizacao: text("pasta_fim_atualizacao").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert Schema
export const insertAutomacaoSchema = createInsertSchema(automacoes).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertAutomacao = z.infer<typeof insertAutomacaoSchema>;
export type Automacao = typeof automacoes.$inferSelect;
