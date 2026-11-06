// Upstash Redis: historia rozmów (pamięć między wizytami) i limity zapytań.
// Wymaga w .env: UPSTASH_REDIS_REST_URL i UPSTASH_REDIS_REST_TOKEN (console.upstash.com → baza → REST API).
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { UIMessage } from 'ai';

const redis = Redis.fromEnv();

export const CHAT_COOKIE = 'chat_id';
export const HISTORY_TTL = 60 * 60 * 24 * 7; // 7 dni: potem Redis sam usuwa rozmowę, a przeglądarka ciasteczko
const MAX_STORED = 40; // shortcut: pamiętamy ostatnie 40 wiadomości; dłuższa rozmowa traci początek

/** Id rozmowy to UUID, który sami wygenerowaliśmy; cokolwiek innego w ciasteczku ignorujemy. */
export const isChatId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id); // UUID v4

const key = (id: string) => `chat:${id}`;
export const loadHistory = async (id: string) => (await redis.get<UIMessage[]>(key(id))) ?? [];
export const saveHistory = (id: string, messages: UIMessage[]) => redis.set(key(id), messages.slice(-MAX_STORED), { ex: HISTORY_TTL });
export const clearHistory = (id: string) => redis.del(key(id));

// Fixed window: najtańszy w komendach Redis. analytics: false, bo analityka dokłada komend (raport limitów).
const limiter = (tokens: number, window: '1 m' | '1 d', prefix: string) =>
  // timeout: 0, bo domyślnie po 5 s wolnego Redis biblioteka PRZEPUSZCZA zapytanie; wolimy poczekać albo dostać błąd (503).
  new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(tokens, window), prefix, analytics: false, timeout: 0 });

const LIMITS = [
  { which: 'minuta', rl: limiter(5, '1 m', 'rl:ip:min'), perIp: true },
  { which: 'dzień', rl: limiter(20, '1 d', 'rl:ip:day'), perIp: true },
  { which: 'global', rl: limiter(100, '1 d', 'rl:all:day'), perIp: false }, // chroni darmowy limit Gemini przed wieloma IP naraz
] as const;

export type LimitHit = { which: (typeof LIMITS)[number]['which']; reset: number };

/** null = można pytać; inaczej pierwszy przekroczony limit i kiedy się odnowi (ms od 1970, jak Date.now()). */
export async function checkLimits(ip: string): Promise<LimitHit | null> {
  for (const { which, rl, perIp } of LIMITS) {
    const { success, reset } = await rl.limit(perIp ? ip : 'all');
    if (!success) return { which, reset }; // kolejnych nie sprawdzamy, więc odrzucone pytanie nie zjada limitu globalnego
  }
  return null;
}
