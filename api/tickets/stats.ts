// api/tickets/stats.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { glpiFetch } from '../_glpi.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await glpiFetch(`/search/Ticket?forcedisplay[0]=2`);
    const data = await r.json();
    const rows = data?.data ?? data ?? [];

    const stats: Record<string, number> = {};
    for (const row of rows) {
      const status = row?.['2'] ?? row?.status ?? 'desconhecido';
      stats[status] = (stats[status] ?? 0) + 1;
    }
    res.status(200).json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
