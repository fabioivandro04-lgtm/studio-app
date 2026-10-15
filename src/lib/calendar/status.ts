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
  draft: 'bg-[var(--st-draft-bg)] text-[var(--st-draft-fg)]',
  scheduled: 'bg-[var(--st-scheduled-bg)] text-[var(--st-scheduled-fg)]',
  publishing: 'bg-[var(--st-publishing-bg)] text-[var(--st-publishing-fg)]',
  needs_action: 'bg-[var(--st-action-bg)] text-[var(--st-action-fg)]',
  published: 'bg-[var(--st-published-bg)] text-[var(--st-published-fg)]',
  partial: 'bg-[var(--st-partial-bg)] text-[var(--st-partial-fg)]',
  failed: 'bg-[var(--st-failed-bg)] text-[var(--st-failed-fg)]',
  cancelled: 'bg-[var(--st-cancelled-bg)] text-[var(--st-cancelled-fg)] line-through',
};

/** Cor do ponto de estado (o texto do estado aparece ao lado). */
export const POST_STATUS_DOT: Record<PostStatus, string> = {
  draft: 'bg-[var(--st-draft-fg)]',
  scheduled: 'bg-[var(--st-scheduled-fg)]',
  publishing: 'bg-[var(--st-publishing-fg)]',
  needs_action: 'bg-[var(--st-action-fg)]',
  published: 'bg-[var(--st-published-fg)]',
  partial: 'bg-[var(--st-partial-fg)]',
  failed: 'bg-[var(--st-failed-fg)]',
  cancelled: 'bg-[var(--st-cancelled-fg)]',
};
