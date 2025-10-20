// api/bases/[id]/status.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../_storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'PATCH') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const baseId = Number(req.query.id);
    const { status, biId } = req.body;

    // Encontrar o BI que contém a base
    const bi = storage.bis.getById(biId);
    if (!bi) {
      return res.status(404).json({ error: 'BI not found' });
    }

    // Atualizar status da base
    const base = bi.bases.find(b => b.id === baseId);
    if (!base) {
      return res.status(404).json({ error: 'Base not found' });
    }

    base.status = status;

    // Verificar se todas as bases estão concluídas
    const allCompleted = bi.bases.every(b => b.status === 'concluído');
    if (allCompleted) {
      bi.concluido = true;
    }

    storage.bis.update(biId, bi);

    return res.status(200).json(bi);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
