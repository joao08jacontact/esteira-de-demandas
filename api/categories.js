// api/categories.js
import { glpiFetch } from './_glpi.js';

export default async function handler(_req, res) {
  try {
    const r = await glpiFetch(`/ITILCategory`);
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
