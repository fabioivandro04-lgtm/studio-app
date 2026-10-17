/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;
type Pred = (r: Row) => boolean;

// Como o PostgREST: % e * são "qualquer coisa", _ é "um carácter", \ escapa.
const likeRe = (v: string) =>
  new RegExp(`^${v.replace(/\\(.)|([%*])|(_)|([.+?^${}()|[\]\\])/g, (_m, esc, many, one, lit) => (esc ? esc.replace(/[.+?^${}()|[\]\\*]/g, '\\$&') : many ? '.*' : one ? '.' : `\\${lit}`))}$`, 'i');

/**
 * Supabase falso em memória para testes das ferramentas MCP: filtros simples (eq, neq, in, gte, gt, lt, lte,
 * ilike, or-ilike), order, delete, limit, single/maybeSingle, insert/update com select, rpc e storage configuráveis.
 * O texto do select é ignorado (devolve linhas completas).
 */
export function fakeDb(tables: Record<string, Row[]>, opts: { rpc?: Record<string, (args: any) => any>; storage?: Record<string, any> } = {}) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  let seq = 0;
  const from = (table: string) => {
    tables[table] ??= [];
    const preds: Pred[] = [];
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row | Row[] | null = null;
    const orderBy: { col: string; asc: boolean }[] = [];
    let lim: number | null = null;
    let mode: 'many' | 'single' | 'maybe' = 'many';
    let countHead = false;
    const run = () => {
      if (op === 'insert') {
        const rows = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({ id: r.id ?? `id-${++seq}`, created_at: new Date().toISOString(), ...r }));
        tables[table].push(...rows);
        calls.push({ table, op, payload });
        return finish(rows);
      }
      let rows = tables[table].filter((r) => preds.every((p) => p(r)));
      if (op === 'update') {
        rows.forEach((r) => Object.assign(r, payload));
        calls.push({ table, op, payload });
      }
      if (op === 'delete') {
        tables[table] = tables[table].filter((r) => !rows.includes(r));
        calls.push({ table, op });
      }
      for (const o of [...orderBy].reverse()) rows = [...rows].sort((a, b) => (a[o.col] > b[o.col] ? 1 : a[o.col] < b[o.col] ? -1 : 0) * (o.asc ? 1 : -1));
      if (lim != null) rows = rows.slice(0, lim);
      if (countHead) return { data: null, error: null, count: rows.length };
      return finish(rows);
    };
    const finish = (rows: Row[]) => {
      if (mode === 'single') return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not single' } };
      if (mode === 'maybe') return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    };
    const b: any = {
      select: (_cols?: string, o?: { count?: string; head?: boolean }) => {
        if (o?.head) countHead = true;
        return b;
      },
      insert: (p: Row | Row[]) => ((op = 'insert'), (payload = p), b),
      update: (p: Row) => ((op = 'update'), (payload = p), b),
      delete: () => ((op = 'delete'), b),
      eq: (c: string, v: any) => (preds.push((r) => r[c] === v), b),
      neq: (c: string, v: any) => (preds.push((r) => r[c] !== v), b),
      in: (c: string, v: any[]) => (preds.push((r) => v.includes(r[c])), b),
      gte: (c: string, v: any) => (preds.push((r) => r[c] != null && r[c] >= v), b),
      gt: (c: string, v: any) => (preds.push((r) => r[c] != null && r[c] > v), b),
      lt: (c: string, v: any) => (preds.push((r) => r[c] != null && r[c] < v), b),
      lte: (c: string, v: any) => (preds.push((r) => r[c] != null && r[c] <= v), b),
      not: (c: string, operator: string, v: any) => (preds.push((r) => (operator === 'is' ? r[c] !== v : r[c] !== v)), b),
      is: (c: string, v: any) => (preds.push((r) => (r[c] ?? null) === v), b),
      ilike: (c: string, v: string) => (preds.push((r) => likeRe(v).test(String(r[c] ?? ''))), b),
      order: (col: string, o?: { ascending?: boolean }) => (orderBy.push({ col, asc: o?.ascending !== false }), b),
      limit: (n: number) => ((lim = n), b),
      single: () => ((mode = 'single'), b),
      maybeSingle: () => ((mode = 'maybe'), b),
      then: (res: (v: any) => any, rej?: (e: any) => any) => Promise.resolve().then(run).then(res, rej),
    };
    return b;
  };
  const db = {
    from,
    rpc: async (name: string, args: any) => {
      calls.push({ table: `rpc:${name}`, op: 'rpc', payload: args });
      try {
        return { data: await opts.rpc![name](args), error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    storage: { from: () => opts.storage ?? {} },
  };
  return { db: db as unknown as SupabaseClient, tables, calls };
}
