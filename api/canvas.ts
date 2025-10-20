// api/canvas.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Canvas data em memória (não persiste)
let canvasData: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json(canvasData || { nodes: [], edges: [] });
    }

    if (req.method === 'POST') {
      canvasData = req.body;
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
