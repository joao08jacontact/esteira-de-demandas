// api/tickets.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { glpiFetch, getRange } from './_glpi.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const page  = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const range = getRange(page, limit);

    const r = await glpiFetch(`/search/Ticket?range=${range}`);
    const data = await r.json();

    res.status(200).json({
      page, limit,
      total: data?.totalcount ?? data?.totalcountwithouthidden ?? undefined,
      items: data?.data ?? data,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
