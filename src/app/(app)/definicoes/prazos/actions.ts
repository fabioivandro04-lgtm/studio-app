'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/db/clients';
import { DeadlineInput, type DeadlineInputT } from '@/lib/deadlines/schema';
import type { ActionResult } from '../actions';

export async function saveDeadline(raw: DeadlineInputT): Promise<ActionResult> {
  const p = DeadlineInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Dados inválidos.' };
  const { id, brandId, dueDate, ...rest } = p.data;
  const row = { brand_id: brandId, due_date: dueDate, ...rest };
  const db = await createServerClient();
  const res = id ? await db.from('deadlines').update(row).eq('id', id) : await db.from('deadlines').insert(row);
  if (res.error) return { ok: false, error: 'Não foi possível guardar o prazo.' };
  revalidatePath('/definicoes/prazos');
  revalidatePath('/calendario');
  return { ok: true };
}

export async function deleteDeadline(id: string): Promise<ActionResult> {
  const db = await createServerClient();
  const { error } = await db.from('deadlines').delete().eq('id', id);
  if (error) return { ok: false, error: 'Não foi possível apagar o prazo.' };
  revalidatePath('/definicoes/prazos');
  revalidatePath('/calendario');
  return { ok: true };
}
