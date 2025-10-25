// api/automacoes/[id].js
import { storage } from '../_storage.js';

export default async function handler(req, res) {
  try {
    const id = String(req.query.id);

    if (req.method === 'GET') {
      const auto = storage.automacoes.getById(id);
      if (!auto) return res.status(404).json({ error: 'Automação not found' });
      return res.status(200).json(auto);
    }

    if (req.method === 'DELETE') {
      const deleted = storage.automacoes.delete(id);
      if (!deleted) return res.status(404).json({ error: 'Automação not found' });
      return res.status(204).end();
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
