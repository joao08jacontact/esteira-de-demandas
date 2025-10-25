// api/canvas.js
import { storage } from './_storage.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const canvas = storage.canvas.get();
      return res.status(200).json(canvas);
    }

    if (req.method === 'POST') {
      const saved = storage.canvas.save(req.body);
      return res.status(200).json(saved);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
