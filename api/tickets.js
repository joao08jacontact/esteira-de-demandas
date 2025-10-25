// api/tickets.js
import { glpiFetch } from './_glpi.js';

export default async function handler(req, res) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    // Fetch all tickets (up to 1000)
    const r = await glpiFetch(`/search/Ticket?range=0-999`);
    const data = await r.json();
    const tickets = data?.data ?? data ?? [];

    // Parse filters from query string
    const filters = {
      search: req.query.search,
      status: req.query.status ? JSON.parse(req.query.status) : null,
      priority: req.query.priority ? JSON.parse(req.query.priority) : null,
      category: req.query.category ? JSON.parse(req.query.category) : null,
      type: req.query.type ? JSON.parse(req.query.type) : null,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      closeDateFrom: req.query.closeDateFrom,
      closeDateTo: req.query.closeDateTo,
      assignedTo: req.query.assignedTo ? JSON.parse(req.query.assignedTo) : null,
      assignedGroup: req.query.assignedGroup ? JSON.parse(req.query.assignedGroup) : null,
      name: req.query.name,
      users_id_recipient: req.query.users_id_recipient ? JSON.parse(req.query.users_id_recipient) : null,
    };

    // Apply filters
    let filteredTickets = tickets;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTickets = filteredTickets.filter(t =>
        t.name?.toLowerCase().includes(searchLower) ||
        t.content?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.status && filters.status.length > 0) {
      filteredTickets = filteredTickets.filter(t => filters.status.includes(t.status));
    }

    if (filters.priority && filters.priority.length > 0) {
      filteredTickets = filteredTickets.filter(t => filters.priority.includes(t.priority));
    }

    if (filters.type && filters.type.length > 0) {
      filteredTickets = filteredTickets.filter(t => filters.type.includes(t.type));
    }

    if (filters.category && filters.category.length > 0) {
      filteredTickets = filteredTickets.filter(t => t.itilcategories_id && filters.category.includes(t.itilcategories_id));
    }

    if (filters.assignedTo && filters.assignedTo.length > 0) {
      filteredTickets = filteredTickets.filter(t => t.users_id_assign && filters.assignedTo.includes(t.users_id_assign));
    }

    if (filters.assignedGroup && filters.assignedGroup.length > 0) {
      filteredTickets = filteredTickets.filter(t => t.groups_id_assign && filters.assignedGroup.includes(t.groups_id_assign));
    }

    if (filters.dateFrom) {
      filteredTickets = filteredTickets.filter(t => t.date && t.date >= filters.dateFrom);
    }

    if (filters.dateTo) {
      filteredTickets = filteredTickets.filter(t => t.date && t.date <= filters.dateTo);
    }

    if (filters.name) {
      const nameLower = filters.name.toLowerCase();
      filteredTickets = filteredTickets.filter(t => t.name?.toLowerCase().includes(nameLower));
    }

    if (filters.closeDateFrom) {
      filteredTickets = filteredTickets.filter(t => t.closedate && t.closedate >= filters.closeDateFrom);
    }

    if (filters.closeDateTo) {
      filteredTickets = filteredTickets.filter(t => t.closedate && t.closedate <= filters.closeDateTo);
    }

    if (filters.users_id_recipient && filters.users_id_recipient.length > 0) {
      filteredTickets = filteredTickets.filter(t => t.users_id_recipient && filters.users_id_recipient.includes(t.users_id_recipient));
    }

    // Apply pagination
    const start = (page - 1) * limit;
    const paginatedTickets = filteredTickets.slice(start, start + limit);

    res.status(200).json(paginatedTickets);
  } catch (e) {
    console.error('[api/tickets] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
