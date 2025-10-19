import { getGlpiClient } from "./glpi-client";
import type { TicketFilters, TicketStats, GlpiTicket } from "@shared/schema";

class TicketService {
  async getTickets(filters: TicketFilters, page: number = 1, limit: number = 20): Promise<GlpiTicket[]> {
    const glpiClient = getGlpiClient();
    
    // Fetch a larger set to apply filtering client-side
    // In production, this should use GLPI's search API properly
    const tickets = await glpiClient.getTickets({
      range: "0-999",
    });

    console.log(`[DEBUG] GLPI returned ${tickets.length} tickets`);

    // Apply filters client-side
    let filteredTickets = tickets;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTickets = filteredTickets.filter((t: any) =>
        t.name?.toLowerCase().includes(searchLower) ||
        t.content?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.status && filters.status.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        filters.status!.includes(t.status)
      );
    }

    if (filters.priority && filters.priority.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        filters.priority!.includes(t.priority)
      );
    }

    if (filters.type && filters.type.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        filters.type!.includes(t.type)
      );
    }

    if (filters.category && filters.category.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.itilcategories_id && filters.category!.includes(t.itilcategories_id)
      );
    }

    if (filters.assignedTo && filters.assignedTo.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.users_id_assign && filters.assignedTo!.includes(t.users_id_assign)
      );
    }

    if (filters.assignedGroup && filters.assignedGroup.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.groups_id_assign && filters.assignedGroup!.includes(t.groups_id_assign)
      );
    }

    if (filters.dateFrom) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.date && t.date >= filters.dateFrom
      );
    }

    if (filters.dateTo) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.date && t.date <= filters.dateTo
      );
    }

    // Apply pagination
    const start = (page - 1) * limit;
    const paginatedTickets = filteredTickets.slice(start, start + limit);

    return paginatedTickets;
  }

  async getStats(filters: TicketFilters): Promise<TicketStats> {
    const glpiClient = getGlpiClient();
    
    // Fetch all tickets (up to 1000 for stats calculation)
    const tickets = await glpiClient.getTickets({
      range: "0-999",
    });

    // Apply filters to tickets
    let filteredTickets = tickets;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTickets = filteredTickets.filter((t: any) =>
        t.name?.toLowerCase().includes(searchLower) ||
        t.content?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.status && filters.status.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        filters.status!.includes(t.status)
      );
    }

    if (filters.priority && filters.priority.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        filters.priority!.includes(t.priority)
      );
    }

    if (filters.type && filters.type.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        filters.type!.includes(t.type)
      );
    }

    if (filters.category && filters.category.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.itilcategories_id && filters.category!.includes(t.itilcategories_id)
      );
    }

    if (filters.assignedTo && filters.assignedTo.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.users_id_assign && filters.assignedTo!.includes(t.users_id_assign)
      );
    }

    if (filters.assignedGroup && filters.assignedGroup.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.groups_id_assign && filters.assignedGroup!.includes(t.groups_id_assign)
      );
    }

    if (filters.dateFrom) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.date && t.date >= filters.dateFrom
      );
    }

    if (filters.dateTo) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.date && t.date <= filters.dateTo
      );
    }

    // Calculate statistics
    const total = filteredTickets.length;
    let newCount = 0;
    let inProgressCount = 0;
    let pendingCount = 0;
    let solvedCount = 0;
    let closedCount = 0;

    const byStatus = new Map<number, number>();
    const byPriority = new Map<number, number>();
    const byType = new Map<number, number>();
    const timelineMap = new Map<string, number>();

    filteredTickets.forEach((ticket: any) => {
      // Count by status
      switch (ticket.status) {
        case 1:
          newCount++;
          break;
        case 2:
          inProgressCount++;
          break;
        case 3:
          pendingCount++;
          break;
        case 4:
          solvedCount++;
          break;
        case 5:
          closedCount++;
          break;
      }

      // Aggregate for charts
      byStatus.set(ticket.status, (byStatus.get(ticket.status) || 0) + 1);
      byPriority.set(ticket.priority, (byPriority.get(ticket.priority) || 0) + 1);
      byType.set(ticket.type, (byType.get(ticket.type) || 0) + 1);

      // Timeline data
      const date = ticket.date ? ticket.date.split(" ")[0] : new Date().toISOString().split("T")[0];
      timelineMap.set(date, (timelineMap.get(date) || 0) + 1);
    });

    // Convert maps to arrays
    const byStatusArray = Array.from(byStatus.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    const byPriorityArray = Array.from(byPriority.entries()).map(([priority, count]) => ({
      priority,
      count,
    }));

    const byTypeArray = Array.from(byType.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    const timeline = Array.from(timelineMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total,
      new: newCount,
      inProgress: inProgressCount,
      pending: pendingCount,
      solved: solvedCount,
      closed: closedCount,
      byStatus: byStatusArray,
      byPriority: byPriorityArray,
      byType: byTypeArray,
      timeline,
    };
  }
}

export const ticketService = new TicketService();
