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
      const dateFrom = filters.dateFrom;
      filteredTickets = filteredTickets.filter((t: any) =>
        t.date && t.date >= dateFrom
      );
    }

    if (filters.dateTo) {
      const dateTo = filters.dateTo;
      filteredTickets = filteredTickets.filter((t: any) =>
        t.date && t.date <= dateTo
      );
    }

    if (filters.name) {
      const nameLower = filters.name.toLowerCase();
      filteredTickets = filteredTickets.filter((t: any) =>
        t.name?.toLowerCase().includes(nameLower)
      );
    }

    if (filters.closeDateFrom) {
      const closeDateFrom = filters.closeDateFrom;
      filteredTickets = filteredTickets.filter((t: any) =>
        t.closedate && t.closedate >= closeDateFrom
      );
    }

    if (filters.closeDateTo) {
      const closeDateTo = filters.closeDateTo;
      filteredTickets = filteredTickets.filter((t: any) =>
        t.closedate && t.closedate <= closeDateTo
      );
    }

    if (filters.users_id_recipient && filters.users_id_recipient.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.users_id_recipient && filters.users_id_recipient!.includes(t.users_id_recipient)
      );
    }

    // Apply pagination
    const start = (page - 1) * limit;
    console.log(`[DEBUG] Returning ${Math.min(limit, filteredTickets.length - start)} tickets for page ${page}`);
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
      const dateFrom = filters.dateFrom;
      filteredTickets = filteredTickets.filter((t: any) =>
        t.date && t.date >= dateFrom
      );
    }

    if (filters.dateTo) {
      const dateTo = filters.dateTo;
      filteredTickets = filteredTickets.filter((t: any) =>
        t.date && t.date <= dateTo
      );
    }

    if (filters.name) {
      const nameLower = filters.name.toLowerCase();
      filteredTickets = filteredTickets.filter((t: any) =>
        t.name?.toLowerCase().includes(nameLower)
      );
    }

    if (filters.closeDateFrom) {
      const closeDateFrom = filters.closeDateFrom;
      filteredTickets = filteredTickets.filter((t: any) =>
        t.closedate && t.closedate >= closeDateFrom
      );
    }

    if (filters.closeDateTo) {
      const closeDateTo = filters.closeDateTo;
      filteredTickets = filteredTickets.filter((t: any) =>
        t.closedate && t.closedate <= closeDateTo
      );
    }

    if (filters.users_id_recipient && filters.users_id_recipient.length > 0) {
      filteredTickets = filteredTickets.filter((t: any) =>
        t.users_id_recipient && filters.users_id_recipient!.includes(t.users_id_recipient)
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
    const byCategory = new Map<number, number>();
    const byRequester = new Map<number, number>();
    const timelineOpenMap = new Map<string, number>();
    const timelineCloseMap = new Map<string, number>();

    let totalCloseDelay = 0;
    let totalSolveDelay = 0;
    let totalTakeIntoAccountDelay = 0;
    let totalWaitingDuration = 0;
    let countWithCloseDelay = 0;
    let countWithSolveDelay = 0;
    let countWithTakeIntoAccountDelay = 0;
    let countWithWaitingDuration = 0;

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
        case 4:
          pendingCount++;
          break;
        case 5:
          solvedCount++;
          break;
        case 6:
          closedCount++;
          break;
      }

      // Aggregate for charts
      byStatus.set(ticket.status, (byStatus.get(ticket.status) || 0) + 1);
      byPriority.set(ticket.priority, (byPriority.get(ticket.priority) || 0) + 1);
      byType.set(ticket.type, (byType.get(ticket.type) || 0) + 1);

      // Category aggregation
      if (ticket.itilcategories_id) {
        byCategory.set(ticket.itilcategories_id, (byCategory.get(ticket.itilcategories_id) || 0) + 1);
      }

      // Requester aggregation
      if (ticket.users_id_recipient) {
        byRequester.set(ticket.users_id_recipient, (byRequester.get(ticket.users_id_recipient) || 0) + 1);
      }

      // Time metrics
      if (ticket.close_delay_stat) {
        totalCloseDelay += ticket.close_delay_stat;
        countWithCloseDelay++;
      }
      if (ticket.solve_delay_stat) {
        totalSolveDelay += ticket.solve_delay_stat;
        countWithSolveDelay++;
      }
      if (ticket.takeintoaccount_delay_stat) {
        totalTakeIntoAccountDelay += ticket.takeintoaccount_delay_stat;
        countWithTakeIntoAccountDelay++;
      }
      if (ticket.waiting_duration) {
        totalWaitingDuration += ticket.waiting_duration;
        countWithWaitingDuration++;
      }

      // Timeline data - opened tickets
      const openDate = ticket.date ? ticket.date.split(" ")[0] : new Date().toISOString().split("T")[0];
      timelineOpenMap.set(openDate, (timelineOpenMap.get(openDate) || 0) + 1);

      // Timeline data - closed tickets
      if (ticket.closedate) {
        const closeDate = ticket.closedate.split(" ")[0];
        timelineCloseMap.set(closeDate, (timelineCloseMap.get(closeDate) || 0) + 1);
      }
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

    // Top requesters (sorted by count, top 10)
    const topRequesters = Array.from(byRequester.entries())
      .map(([userId, count]) => ({
        userId,
        userName: `User ${userId}`, // Will be enriched on frontend
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // By category (sorted by count)
    const byCategoryArray = Array.from(byCategory.entries())
      .map(([categoryId, count]) => ({
        categoryId,
        categoryName: `Category ${categoryId}`, // Will be enriched on frontend
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Timeline comparison (opened vs closed)
    const allDates = new Set([
      ...Array.from(timelineOpenMap.keys()),
      ...Array.from(timelineCloseMap.keys()),
    ]);
    const timelineComparison = Array.from(allDates)
      .map((date) => ({
        date,
        opened: timelineOpenMap.get(date) || 0,
        closed: timelineCloseMap.get(date) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Simple timeline (just opened tickets)
    const timeline = Array.from(timelineOpenMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate average time metrics (in seconds)
    const avgCloseDelay = countWithCloseDelay > 0 ? totalCloseDelay / countWithCloseDelay : 0;
    const avgSolveDelay = countWithSolveDelay > 0 ? totalSolveDelay / countWithSolveDelay : 0;
    const avgTakeIntoAccountDelay = countWithTakeIntoAccountDelay > 0 
      ? totalTakeIntoAccountDelay / countWithTakeIntoAccountDelay 
      : 0;
    const avgWaitingDuration = countWithWaitingDuration > 0 
      ? totalWaitingDuration / countWithWaitingDuration 
      : 0;

    return {
      total,
      new: newCount,
      inProgress: inProgressCount,
      pending: pendingCount,
      solved: solvedCount,
      closed: closedCount,
      avgCloseDelay,
      avgSolveDelay,
      avgTakeIntoAccountDelay,
      avgWaitingDuration,
      byStatus: byStatusArray,
      byPriority: byPriorityArray,
      byType: byTypeArray,
      byCategory: byCategoryArray,
      topRequesters,
      timeline,
      timelineComparison,
    };
  }
}

export const ticketService = new TicketService();
