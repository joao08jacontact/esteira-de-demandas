// api/bis.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from './_storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const bis = storage.bis.getAll();
      return res.status(200).json(bis);
    }

    if (req.method === 'POST') {
      const newBi = storage.bis.create(req.body);
      return res.status(201).json(newBi);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
