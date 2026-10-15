import type { PostStatus } from '@/lib/platforms/types';

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  publishing: 'A publicar',
  needs_action: 'Aguarda 1 toque',
  published: 'Publicado',
  partial: 'Parcial',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

export const POST_STATUS_CLASS: Record<PostStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-900',
  publishing: 'bg-indigo-100 text-indigo-900',
  needs_action: 'bg-amber-100 text-amber-950',
  published: 'bg-emerald-100 text-emerald-900',
  partial: 'bg-orange-100 text-orange-900',
  failed: 'bg-red-100 text-red-900',
  cancelled: 'bg-slate-100 text-slate-500 line-through',
};
