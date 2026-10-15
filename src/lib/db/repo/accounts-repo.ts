import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountProfile, Platform, TokenSet } from '@/lib/platforms/types';
import { tokenColumns } from './tick-repo';

/** Cria ou atualiza a conta ligada (cliente de serviço — escreve tokens encriptados). */
export async function upsertAccount(
  db: SupabaseClient,
  tokenKey: string,
  brandId: string,
  platform: Platform,
  profile: AccountProfile,
  tokens: TokenSet,
): Promise<string> {
  const { data, error } = await db
    .from('social_accounts')
    .upsert(
      {
        brand_id: brandId,
        platform,
        external_id: profile.externalId,
        handle: profile.handle,
        display_name: profile.displayName,
        avatar_url: profile.avatarUrl,
        status: 'active',
        status_message: null,
        ...tokenColumns(tokens, tokenKey),
      },
      { onConflict: 'brand_id,platform,external_id' },
    )
    .select('id')
    .single();
  if (error) throw new Error(`upsertAccount: ${error.message}`);
  return data.id as string;
}

/** Contas com destinos ainda por publicar. */
export async function countOpenTargets(db: SupabaseClient, accountId: string): Promise<number> {
  const { count, error } = await db
    .from('post_targets')
    .select('id', { count: 'exact', head: true })
    .eq('social_account_id', accountId)
    .in('status', ['pending', 'uploading', 'processing']);
  if (error) throw new Error(`countOpenTargets: ${error.message}`);
  return count ?? 0;
}
