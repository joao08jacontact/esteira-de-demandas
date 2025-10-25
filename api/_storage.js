// api/_storage.js

class MemStorage {
  constructor() {
    this.bisStore = [];
    this.automacaoStore = [];
    this.canvasStore = { nodes: [], edges: [] };
  }

  // BIs
  bis = {
    getAll: () => this.bisStore,
    getById: (id) => this.bisStore.find(b => b.id === id),
    create: (data) => {
      const newBi = {
        id: String(Date.now()),
        ...data,
        dataCriacao: data.dataCriacao || new Date().toISOString(),
        bases: data.bases || [],
        status: 'em_andamento',
        ativo: true,
      };
      this.bisStore.push(newBi);
      return newBi;
    },
    update: (id, data) => {
      const idx = this.bisStore.findIndex(b => b.id === id);
      if (idx === -1) return null;
      this.bisStore[idx] = { ...this.bisStore[idx], ...data };
      return this.bisStore[idx];
    },
    delete: (id) => {
      const idx = this.bisStore.findIndex(b => b.id === id);
      if (idx === -1) return false;
      this.bisStore.splice(idx, 1);
      return true;
    },
  };

  // Automações
  automacoes = {
    getAll: () => this.automacaoStore,
    getById: (id) => this.automacaoStore.find(a => a.id === id),
    create: (data) => {
      const newAuto = {
        id: String(Date.now()),
        ...data,
      };
      this.automacaoStore.push(newAuto);
      return newAuto;
    },
    delete: (id) => {
      const idx = this.automacaoStore.findIndex(a => a.id === id);
      if (idx === -1) return false;
      this.automacaoStore.splice(idx, 1);
      return true;
    },
  };

  // Canvas
  canvas = {
    get: () => this.canvasStore,
    save: (data) => {
      this.canvasStore = data;
      return this.canvasStore;
    },
  };
}

export const storage = new MemStorage();
