// api/automacoes.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from './_storage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const automacoes = storage.automacoes.getAll();
      return res.status(200).json(automacoes);
    }

    if (req.method === 'POST') {
      const newAuto = storage.automacoes.create(req.body);
      return res.status(201).json(newAuto);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
