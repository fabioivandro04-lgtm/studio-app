import type { Platform, TargetFormat } from '@/lib/platforms/types';
import { assertWithinBudget } from './budget';
import { AI_MESSAGES, AiError } from './errors';
import { buildRefineMessages, buildSuggestMessages, buildVoiceMessages } from './prompts';
import { AI_RULES } from './rules';
import { postprocessSuggestions, RefinedSpec, SuggestionsSpec, VoiceSpec } from './schemas';
import type { AiProvider, AiUsage, BrandAi, RefineAction, Suggestions } from './types';

export interface AiDeps {
  provider: AiProvider | null;
  model: string;
  limitUsd: number;
  spentUsd: number;
  recordUsage(u: { brandId: string | null; kind: 'suggest' | 'refine' | 'voice'; model: string; usage: AiUsage }): Promise<void>;
}

const VOICE_MAX = 2000;

function ready(d: AiDeps): AiProvider {
  if (!d.provider) throw new AiError('no_key', AI_MESSAGES.no_key);
  assertWithinBudget(d.spentUsd, d.limitUsd);
  return d.provider;
}

const invalid = (message: string) => new AiError('invalid_input', message);

export async function runSuggest(
  d: AiDeps,
  i: { brandId: string; brand: BrandAi; prompt: string; imageUrl: string | null; targets: { platform: Platform; format: TargetFormat }[] },
): Promise<Suggestions> {
  const provider = ready(d);
  if (!i.prompt.trim()) throw invalid('Escreva sobre o que é o post.');
  if (i.targets.length === 0) throw invalid('Escolha pelo menos uma rede.');
  const { data, usage } = await provider.chat({ model: d.model, messages: buildSuggestMessages(i), spec: SuggestionsSpec, maxTokens: 1500 });
  await d.recordUsage({ brandId: i.brandId, kind: 'suggest', model: d.model, usage });
  return postprocessSuggestions(data, { platforms: i.targets.map((t) => t.platform), fixedHashtags: i.brand.aiHashtags });
}

export async function runRefine(
  d: AiDeps,
  i: { brandId: string; brand: BrandAi; platform: Platform; text: string; action: RefineAction },
): Promise<string> {
  const provider = ready(d);
  if (!i.text.trim()) throw invalid('Escreva primeiro uma legenda.');
  const { data, usage } = await provider.chat({ model: d.model, messages: buildRefineMessages(i), spec: RefinedSpec, maxTokens: 600 });
  await d.recordUsage({ brandId: i.brandId, kind: 'refine', model: d.model, usage });
  return data.text.trim().slice(0, AI_RULES[i.platform].captionMax);
}

export async function runDraftVoice(d: AiDeps, i: { brandId: string; brand: BrandAi; captions: string[] }): Promise<string> {
  const provider = ready(d);
  if (!i.captions.some((c) => c.trim())) throw invalid('Não há legendas no Instagram para analisar.');
  const { data, usage } = await provider.chat({ model: d.model, messages: buildVoiceMessages(i), spec: VoiceSpec, maxTokens: 800 });
  await d.recordUsage({ brandId: i.brandId, kind: 'voice', model: d.model, usage });
  return data.voice.trim().slice(0, VOICE_MAX);
}
