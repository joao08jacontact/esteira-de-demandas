// api/tickets/stats.js
import { glpiFetch } from '../_glpi.js';

export default async function handler(_req, res) {
  try {
    const r = await glpiFetch(`/search/Ticket?forcedisplay[0]=2`);
    const data = await r.json();
    const rows = data?.data ?? data ?? [];

    const stats = {};
    for (const row of rows) {
      const status = row?.['2'] ?? row?.status ?? 'desconhecido';
      stats[status] = (stats[status] ?? 0) + 1;
    }
    res.status(200).json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
