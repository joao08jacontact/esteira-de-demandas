import {
  type User,
  type InsertUser,
  type Bi,
  type InsertBi,
  type BaseOrigem,
  type CanvasNode,
  type InsertCanvasNode,
  type CanvasEdge,
  type InsertCanvasEdge,
  type BiWithBases,
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // BI operations
  getAllBis(): Promise<BiWithBases[]>;
  getBiById(id: string): Promise<BiWithBases | undefined>;
  createBi(
    bi: InsertBi,
    bases: Array<{ nomeFerramenta: string; pastaOrigem: string; temApi: boolean }>
  ): Promise<Bi>;
  updateBiStatus(id: string, status: string): Promise<Bi | undefined>;
  updateBiInativo(id: string, inativo: boolean): Promise<Bi | undefined>;

  // Base operations
  getBasesByBiId(biId: string): Promise<BaseOrigem[]>;
  updateBaseStatus(
    id: string,
    status: string,
    observacao?: string
  ): Promise<BaseOrigem | undefined>;

  // Canvas operations
  getCanvasData(): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] }>;
  saveCanvasData(
    nodes: InsertCanvasNode[],
    edges: InsertCanvasEdge[]
  ): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private bis: Map<string, Bi>;
  private bases: Map<string, BaseOrigem>;
  private canvasNodes: Map<string, CanvasNode>;
  private canvasEdges: Map<string, CanvasEdge>;

  constructor() {
    this.users = new Map();
    this.bis = new Map();
    this.bases = new Map();
    this.canvasNodes = new Map();
    this.canvasEdges = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // BI operations
  async getAllBis(): Promise<BiWithBases[]> {
    const allBis = Array.from(this.bis.values());
    const bisWithBases: BiWithBases[] = [];

    for (const bi of allBis) {
      const bases = await this.getBasesByBiId(bi.id);
      bisWithBases.push({ ...bi, bases });
    }

    return bisWithBases.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getBiById(id: string): Promise<BiWithBases | undefined> {
    const bi = this.bis.get(id);
    if (!bi) return undefined;

    const bases = await this.getBasesByBiId(id);
    return { ...bi, bases };
  }

  async createBi(
    insertBi: InsertBi,
    insertBases: Array<{ nomeFerramenta: string; pastaOrigem: string; temApi: boolean }>
  ): Promise<Bi> {
    const id = randomUUID();
    const bi: Bi = {
      ...insertBi,
      id,
      status: "em_aberto",
      inativo: false,
      createdAt: new Date(),
    };

    this.bis.set(id, bi);

    // Create bases
    for (const insertBase of insertBases) {
      const baseId = randomUUID();
      const base: BaseOrigem = {
        id: baseId,
        biId: id,
        nomeFerramenta: insertBase.nomeFerramenta,
        pastaOrigem: insertBase.pastaOrigem,
        temApi: insertBase.temApi,
        status: "aguardando",
        observacao: null,
      };
      this.bases.set(baseId, base);
    }

    return bi;
  }

  async updateBiStatus(id: string, status: string): Promise<Bi | undefined> {
    const bi = this.bis.get(id);
    if (!bi) return undefined;

    const updatedBi: Bi = { ...bi, status };
    this.bis.set(id, updatedBi);
    return updatedBi;
  }

  async updateBiInativo(id: string, inativo: boolean): Promise<Bi | undefined> {
    const bi = this.bis.get(id);
    if (!bi) return undefined;

    const updatedBi: Bi = { ...bi, inativo };
    this.bis.set(id, updatedBi);
    return updatedBi;
  }

  // Base operations
  async getBasesByBiId(biId: string): Promise<BaseOrigem[]> {
    return Array.from(this.bases.values()).filter(
      (base) => base.biId === biId
    );
  }

  async updateBaseStatus(
    id: string,
    status: string,
    observacao?: string
  ): Promise<BaseOrigem | undefined> {
    const base = this.bases.get(id);
    if (!base) return undefined;

    const updatedBase: BaseOrigem = {
      ...base,
      status,
      observacao: observacao !== undefined ? observacao : base.observacao,
    };
    this.bases.set(id, updatedBase);

    // Check if all bases of this BI are completed
    const allBases = await this.getBasesByBiId(base.biId);
    const allCompleted = allBases.every((b) => b.status === "concluido");

    if (allCompleted) {
      await this.updateBiStatus(base.biId, "concluido");
    }

    return updatedBase;
  }

  // Canvas operations
  async getCanvasData(): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] }> {
    return {
      nodes: Array.from(this.canvasNodes.values()),
      edges: Array.from(this.canvasEdges.values()),
    };
  }

  async saveCanvasData(
    nodes: InsertCanvasNode[],
    edges: InsertCanvasEdge[]
  ): Promise<void> {
    // Clear existing data
    this.canvasNodes.clear();
    this.canvasEdges.clear();

    // Save nodes
    for (const node of nodes) {
      const canvasNode: CanvasNode = {
        id: node.id,
        type: node.type || "default",
        positionX: node.positionX,
        positionY: node.positionY,
        data: node.data,
        width: node.width || null,
        height: node.height || null,
      };
      this.canvasNodes.set(node.id, canvasNode);
    }

    // Save edges
    for (const edge of edges) {
      const canvasEdge: CanvasEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || "smoothstep",
        animated: edge.animated || false,
      };
      this.canvasEdges.set(edge.id, canvasEdge);
    }
  }
}

export const storage = new MemStorage();
