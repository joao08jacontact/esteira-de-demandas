// api/bis.js
import { storage } from './_storage.js';

export default async function handler(req, res) {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
