// api/_storage.ts - Storage simples em memória (não persiste entre invocações serverless)
// NOTA: Em produção real, use um banco de dados (Vercel Postgres, MongoDB, etc)

interface BI {
  id: number;
  nomeDemanda: string;
  responsavel: string;
  operacao: string;
  dataSolicitacao: string;
  dataCriacao?: string;
  ativo: boolean;
  concluido: boolean;
  bases: Base[];
}

interface Base {
  id: number;
  nomeBase: string;
  status: 'aguardando' | 'pendente' | 'concluído';
}

interface Automacao {
  id: number;
  nomeIntegracao: string;
  recorrencia: string;
  dataHora: string;
  repetirUmaHora: boolean;
  nomeExecutavel: string;
  pastaFimAtualizacao: string;
}

const bis: BI[] = [];
const automacoes: Automacao[] = [];

export const storage = {
  bis: {
    getAll: () => bis,
    getById: (id: number) => bis.find(b => b.id === id),
    create: (data: Omit<BI, 'id'>) => {
      const id = bis.length > 0 ? Math.max(...bis.map(b => b.id)) + 1 : 1;
      const newBi = { ...data, id };
      bis.push(newBi);
      return newBi;
    },
    update: (id: number, data: Partial<BI>) => {
      const index = bis.findIndex(b => b.id === id);
      if (index === -1) return null;
      bis[index] = { ...bis[index], ...data };
      return bis[index];
    },
    delete: (id: number) => {
      const index = bis.findIndex(b => b.id === id);
      if (index === -1) return false;
      bis.splice(index, 1);
      return true;
    },
  },
  automacoes: {
    getAll: () => automacoes,
    getById: (id: number) => automacoes.find(a => a.id === id),
    create: (data: Omit<Automacao, 'id'>) => {
      const id = automacoes.length > 0 ? Math.max(...automacoes.map(a => a.id)) + 1 : 1;
      const newAuto = { ...data, id };
      automacoes.push(newAuto);
      return newAuto;
    },
    delete: (id: number) => {
      const index = automacoes.findIndex(a => a.id === id);
      if (index === -1) return false;
      automacoes.splice(index, 1);
      return true;
    },
  },
};
