// src/hooks/useTasks.ts
import { useEffect, useState, useCallback } from 'react';
import { CLOUD_ENABLED, supabase, TaskRow } from '../lib/supabase';

export type UTask = TaskRow;

const LS_PREFIX = 'demand_timeline_tasks_v1__';
const lsKey = (ws: string) => `${LS_PREFIX}${ws}`;

// ---- LocalStorage (fallback) ----
function loadLocal(ws: string): UTask[] {
  try {
    const raw = localStorage.getItem(lsKey(ws));
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
  } catch {}
  return [];
}
function saveLocal(ws: string, tasks: UTask[]) {
  localStorage.setItem(lsKey(ws), JSON.stringify(tasks));
}

export function useTasks(workspace: string) {
  const [tasks, setTasks] = useState<UTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!CLOUD_ENABLED || !supabase) {
      setTasks(loadLocal(workspace));
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('workspace', workspace)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[fetchTasks]', error);
      setLoading(false);
      return;
    }
    setTasks((data ?? []) as UTask[]);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Realtime
  useEffect(() => {
    if (!CLOUD_ENABLED || !supabase) return;
    const ch = supabase
      .channel('task_templates:' + workspace)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_templates', filter: `workspace=eq.${workspace}` },
        () => fetchTasks()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspace, fetchTasks]);

  // ---- CRUD ----
  async function addTask(input: Omit<UTask, 'id' | 'created_at' | 'workspace'>) {
    if (CLOUD_ENABLED && supabase) {
      const { error } = await supabase
        .from('task_templates')
        .insert({
          workspace,
          titulo: input.titulo,
          inicio: input.inicio,
          fim: input.fim,
          concluida: !!input.concluida,
          rec: input.rec ?? { kind: 'daily' }
        });
      if (error) console.error('[insert]', error);
    } else {
      const row: UTask = {
        id: crypto.randomUUID(),
        workspace,
        titulo: input.titulo,
        inicio: input.inicio,
        fim: input.fim,
        concluida: !!input.concluida,
        rec: input.rec ?? { kind: 'daily' },
        created_at: new Date().toISOString()
      };
      const next = [...tasks, row];
      setTasks(next);
      saveLocal(workspace, next);
    }
  }

  async function toggleDone(id: string, concluida: boolean) {
    if (CLOUD_ENABLED && supabase) {
      const { error } = await supabase
        .from('task_templates')
        .update({ concluida })
        .eq('id', id)
        .eq('workspace', workspace);
      if (error) console.error('[update]', error);
    } else {
      const next = tasks.map(t => t.id === id ? { ...t, concluida } : t);
      setTasks(next);
      saveLocal(workspace, next);
    }
  }

  async function removeTask(id: string) {
    if (CLOUD_ENABLED && supabase) {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', id)
        .eq('workspace', workspace);
      if (error) console.error('[delete]', error);
    } else {
      const next = tasks.filter(t => t.id !== id);
      setTasks(next);
      saveLocal(workspace, next);
    }
  }

  async function clearWorkspace() {
    if (CLOUD_ENABLED && supabase) {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('workspace', workspace);
      if (error) console.error('[clear]', error);
    } else {
      setTasks([]);
      saveLocal(workspace, []);
    }
  }

  return { tasks, loading, addTask, toggleDone, removeTask, clearWorkspace, cloud: CLOUD_ENABLED };
}
