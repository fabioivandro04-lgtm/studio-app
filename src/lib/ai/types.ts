import type { Platform } from '@/lib/platforms/types';

export type Goal = 'contacts' | 'reach';
export type RefineAction = 'shorten' | 'catchy' | 'professional' | 'cta' | 'english';

/** O que a IA sabe de uma marca. */
export interface BrandAi {
  name: string;
  aiContext: string;
  aiVoice: string;
  aiHashtags: string[];
  goal: Goal;
}

export interface PlatformSuggestion {
  platform: Platform;
  captions: string[];
  hashtags: string[];
}

export interface Suggestions {
  internalTitle: string;
  youtubeTitle: string | null;
  byPlatform: PlatformSuggestion[];
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user';
  content: string | ContentPart[];
}

/** Esquema JSON enviado ao modelo + validação local da resposta. */
export interface JsonSchemaSpec<T> {
  name: string;
  schema: Record<string, unknown>;
  parse(x: unknown): T;
}

export interface AiProvider {
  chat<T>(req: { model: string; messages: ChatMessage[]; spec: JsonSchemaSpec<T>; maxTokens: number; timeoutMs?: number }): Promise<{ data: T; usage: AiUsage }>;
}

/** Router do OpenRouter que escolhe um modelo gratuito com as capacidades pedidas (JSON, imagem). */
export const FREE_MODEL = 'openrouter/free';
export const isFreeModel = (model: string) => model === FREE_MODEL || model.endsWith(':free');

export const AI_MODELS = [
  { id: 'anthropic/claude-sonnet-5.5', label: 'Normal — Claude Sonnet 5.5' },
  { id: 'anthropic/claude-haiku-5.5', label: 'Económico — Claude Haiku 5.5' },
  { id: FREE_MODEL, label: 'Grátis — modelos gratuitos (mais lento, com limite diário de pedidos)' },
] as const;
