// api/categories.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { glpiFetch } from './_glpi.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await glpiFetch(`/ITILCategory`);
    const data = await r.json();
    res.status(200).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
