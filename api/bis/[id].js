// api/bis/[id].js
import { storage } from '../_storage.js';

export default async function handler(req, res) {
  try {
    const id = String(req.query.id);

    if (req.method === 'GET') {
      const bi = storage.bis.getById(id);
      if (!bi) return res.status(404).json({ error: 'BI not found' });
      return res.status(200).json(bi);
    }

    if (req.method === 'PATCH') {
      const updated = storage.bis.update(id, req.body);
      if (!updated) return res.status(404).json({ error: 'BI not found' });
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const deleted = storage.bis.delete(id);
      if (!deleted) return res.status(404).json({ error: 'BI not found' });
      return res.status(204).end();
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
