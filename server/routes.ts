import type { Express } from "express";
import { createServer, type Server } from "http";
import { ticketService } from "./ticket-service";
import { ticketFiltersSchema, insertBiSchema, updateBaseOrigemStatusSchema, updateBiInativoSchema } from "@shared/schema";
import { getGlpiClient } from "./glpi-client";
import { storage } from "./storage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get categories from GLPI
  app.get("/api/categories", async (req, res) => {
    try {
      const glpiClient = getGlpiClient();
      const categories = await glpiClient.getCategories();
      
      // Transform to simple format: { id, name }
      const simplified = categories.map((cat: any) => ({
        id: cat.id,
        name: cat.completename || cat.name || `Category ${cat.id}`,
      }));
      
      res.json(simplified);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ 
        error: "Failed to fetch categories",
        message: error.message 
      });
    }
  });

  // Get users (technicians) from GLPI
  app.get("/api/users", async (req, res) => {
    try {
      const glpiClient = getGlpiClient();
      const users = await glpiClient.getUsers();
      
      // Transform to simple format: { id, name }
      const simplified = users
        .filter((user: any) => user.is_active)
        .map((user: any) => ({
          id: user.id,
          name: user.realname || user.name || `User ${user.id}`,
        }));
      
      res.json(simplified);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ 
        error: "Failed to fetch users",
        message: error.message 
      });
    }
  });

  // Get groups from GLPI
  app.get("/api/groups", async (req, res) => {
    try {
      const glpiClient = getGlpiClient();
      const groups = await glpiClient.getGroups();
      
      // Transform to simple format: { id, name }
      const simplified = groups.map((group: any) => ({
        id: group.id,
        name: group.name || group.completename || `Group ${group.id}`,
      }));
      
      res.json(simplified);
    } catch (error: any) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ 
        error: "Failed to fetch groups",
        message: error.message 
      });
    }
  });

  // Get ticket statistics (MUST come before /api/tickets to avoid route conflict)
  app.get("/api/tickets/stats", async (req, res) => {
    try {
      // Parse and validate filters with Zod
      let rawFilters;
      try {
        rawFilters = {
          search: req.query.search as string | undefined,
          status: req.query.status ? JSON.parse(req.query.status as string) : undefined,
          priority: req.query.priority ? JSON.parse(req.query.priority as string) : undefined,
          category: req.query.category ? JSON.parse(req.query.category as string) : undefined,
          type: req.query.type ? JSON.parse(req.query.type as string) : undefined,
          dateFrom: req.query.dateFrom as string | undefined,
          dateTo: req.query.dateTo as string | undefined,
          closeDateFrom: req.query.closeDateFrom as string | undefined,
          closeDateTo: req.query.closeDateTo as string | undefined,
          assignedTo: req.query.assignedTo ? JSON.parse(req.query.assignedTo as string) : undefined,
          assignedGroup: req.query.assignedGroup ? JSON.parse(req.query.assignedGroup as string) : undefined,
          name: req.query.name as string | undefined,
          users_id_recipient: req.query.users_id_recipient ? JSON.parse(req.query.users_id_recipient as string) : undefined,
        };
      } catch (parseError) {
        return res.status(400).json({
          error: "Malformed filter parameters",
          message: "Failed to parse JSON in filter parameters",
        });
      }

      const validationResult = ticketFiltersSchema.safeParse(rawFilters);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid filters",
          details: validationResult.error.errors,
        });
      }

      const stats = await ticketService.getStats(validationResult.data);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ 
        error: "Failed to fetch statistics",
        message: error.message 
      });
    }
  });

  // Get tickets with filters and pagination
  app.get("/api/tickets", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Parse and validate filters with Zod
      let rawFilters;
      try {
        rawFilters = {
          search: req.query.search as string | undefined,
          status: req.query.status ? JSON.parse(req.query.status as string) : undefined,
          priority: req.query.priority ? JSON.parse(req.query.priority as string) : undefined,
          category: req.query.category ? JSON.parse(req.query.category as string) : undefined,
          type: req.query.type ? JSON.parse(req.query.type as string) : undefined,
          dateFrom: req.query.dateFrom as string | undefined,
          dateTo: req.query.dateTo as string | undefined,
          closeDateFrom: req.query.closeDateFrom as string | undefined,
          closeDateTo: req.query.closeDateTo as string | undefined,
          assignedTo: req.query.assignedTo ? JSON.parse(req.query.assignedTo as string) : undefined,
          assignedGroup: req.query.assignedGroup ? JSON.parse(req.query.assignedGroup as string) : undefined,
          name: req.query.name as string | undefined,
          users_id_recipient: req.query.users_id_recipient ? JSON.parse(req.query.users_id_recipient as string) : undefined,
        };
      } catch (parseError) {
        return res.status(400).json({
          error: "Malformed filter parameters",
          message: "Failed to parse JSON in filter parameters",
        });
      }

      const validationResult = ticketFiltersSchema.safeParse(rawFilters);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid filters",
          details: validationResult.error.errors,
        });
      }

      const tickets = await ticketService.getTickets(validationResult.data, page, limit);
      console.log(`[DEBUG] Returning ${tickets.length} tickets for page ${page}`);
      res.json(tickets);
    } catch (error: any) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ 
        error: "Failed to fetch tickets",
        message: error.message 
      });
    }
  });

  // Get full ticket details (for debugging/inspection)
  app.get("/api/tickets/:id/full", async (req, res) => {
    try {
      const glpiClient = getGlpiClient();
      const ticket = await glpiClient.getTicket(parseInt(req.params.id));
      res.json(ticket);
    } catch (error: any) {
      console.error("Error fetching full ticket:", error);
      res.status(500).json({ 
        error: "Failed to fetch ticket details",
        message: error.message 
      });
    }
  });

  // ===========================
  // BI Cadastro Routes
  // ===========================

  // Get all BIs with their bases
  app.get("/api/bis", async (_req, res) => {
    try {
      const bis = await storage.getAllBis();
      res.json(bis);
    } catch (error) {
      console.error("Error getting BIs:", error);
      res.status(500).json({ error: "Failed to get BIs" });
    }
  });

  // Get a single BI by ID
  app.get("/api/bis/:id", async (req, res) => {
    try {
      const bi = await storage.getBiById(req.params.id);
      if (!bi) {
        return res.status(404).json({ error: "BI not found" });
      }
      res.json(bi);
    } catch (error) {
      console.error("Error getting BI:", error);
      res.status(500).json({ error: "Failed to get BI" });
    }
  });

  // Create a new BI with bases
  app.post("/api/bis", async (req, res) => {
    try {
      const validationSchema = insertBiSchema.extend({
        bases: z.array(
          z.object({
            nomeBase: z.string(),
            temApi: z.boolean(),
          })
        ),
      });

      const data = validationSchema.parse(req.body);
      const { bases, ...biData } = data;

      const bi = await storage.createBi(biData, bases);
      res.status(201).json(bi);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating BI:", error);
      res.status(500).json({ error: "Failed to create BI" });
    }
  });

  // Update BI inativo status
  app.patch("/api/bis/:id/inativar", async (req, res) => {
    try {
      const data = updateBiInativoSchema.parse(req.body);
      const bi = await storage.updateBiInativo(req.params.id, data.inativo);

      if (!bi) {
        return res.status(404).json({ error: "BI not found" });
      }

      res.json(bi);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating BI:", error);
      res.status(500).json({ error: "Failed to update BI" });
    }
  });

  // Update base status
  app.patch("/api/bases/:id/status", async (req, res) => {
    try {
      const data = updateBaseOrigemStatusSchema.parse(req.body);
      const base = await storage.updateBaseStatus(
        req.params.id,
        data.status,
        data.observacao
      );

      if (!base) {
        return res.status(404).json({ error: "Base not found" });
      }

      res.json(base);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating base status:", error);
      res.status(500).json({ error: "Failed to update base status" });
    }
  });

  // Get canvas data
  app.get("/api/canvas", async (_req, res) => {
    try {
      const canvasData = await storage.getCanvasData();
      res.json(canvasData);
    } catch (error) {
      console.error("Error getting canvas data:", error);
      res.status(500).json({ error: "Failed to get canvas data" });
    }
  });

  // Save canvas data
  app.post("/api/canvas", async (req, res) => {
    try {
      const { nodes, edges } = req.body;

      if (!Array.isArray(nodes) || !Array.isArray(edges)) {
        return res.status(400).json({ error: "Invalid canvas data format" });
      }

      await storage.saveCanvasData(nodes, edges);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving canvas data:", error);
      res.status(500).json({ error: "Failed to save canvas data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
