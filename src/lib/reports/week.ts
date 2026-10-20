import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { WeekFacts } from '@/lib/ai/report-prompts';
import type { AdStats } from '@/lib/ads/types';
import { PLATFORM_LABEL, type Platform } from '@/lib/platforms/types';

/** Última semana completa (segunda a domingo) no fuso da marca, em yyyy-MM-dd. */
export function lastFullWeek(now: Date, tz: string): { weekStart: string; weekEnd: string } {
  const isoDow = Number(formatInTimeZone(now, tz, 'i')); // 1 = segunda
  const today = fromZonedTime(`${formatInTimeZone(now, tz, 'yyyy-MM-dd')}T12:00:00`, tz);
  const thisMonday = addDays(today, -(isoDow - 1));
  const day = (d: Date) => formatInTimeZone(d, tz, 'yyyy-MM-dd');
  return { weekStart: day(addDays(thisMonday, -7)), weekEnd: day(addDays(thisMonday, -1)) };
}

export const shiftDays = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10);
};

export interface PublishedTarget {
  title: string;
  platform: Platform;
  /** yyyy-MM-dd no fuso da marca. */
  publishedOn: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

const sum = (xs: PublishedTarget[], k: 'views' | 'reach' | 'likes' | 'comments' | 'shares' | 'saves') => xs.reduce((a, x) => a + (x[k] ?? 0), 0);

/** Junta os números da semana (posts publicados nela, com os últimos valores conhecidos) para a IA comentar. */
export function buildWeekFacts(i: {
  weekStart: string;
  weekEnd: string;
  targets: PublishedTarget[];
  followersGained: number | null;
  ads: (AdStats & { currency: string })[];
  scheduledNextWeek: number;
}): WeekFacts {
  const prevStart = shiftDays(i.weekStart, -7);
  const prevEnd = shiftDays(i.weekEnd, -7);
  const inWeek = i.targets.filter((t) => t.publishedOn >= i.weekStart && t.publishedOn <= i.weekEnd);
  const inPrev = i.targets.filter((t) => t.publishedOn >= prevStart && t.publishedOn <= prevEnd);
  return {
    weekStart: i.weekStart,
    weekEnd: i.weekEnd,
    postsPublished: inWeek.length,
    views: sum(inWeek, 'views'),
    reach: sum(inWeek, 'reach'),
    likes: sum(inWeek, 'likes'),
    comments: sum(inWeek, 'comments'),
    shares: sum(inWeek, 'shares'),
    saves: sum(inWeek, 'saves'),
    previous: inPrev.length ? { views: sum(inPrev, 'views'), reach: sum(inPrev, 'reach'), likes: sum(inPrev, 'likes') } : null,
    followersGained: i.followersGained,
    topPosts: [...inWeek]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 3)
      .map((t) => ({ title: t.title || 'Sem título', network: PLATFORM_LABEL[t.platform], views: t.views ?? 0, reach: t.reach ?? 0 })),
    ads: i.ads
      .filter((a) => a.spend > 0)
      .map((a) => ({ spend: a.spend, currency: a.currency, reach: a.reach, linkClicks: a.linkClicks, conversations: a.conversations, leads: a.leads })),
    scheduledNextWeek: i.scheduledNextWeek,
  };
}
