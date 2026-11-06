// Strona renderowana na serwerze: po ciasteczku wczytuje zapisaną rozmowę, zanim przeglądarka pokaże czat.
import { cookies } from 'next/headers';
import { NOT_FOUND } from '../lib/rag.mjs';
import { CHAT_COOKIE, isChatId, loadHistory } from '../lib/upstash';
import Chat from './chat';

export default async function Page() {
  const id = (await cookies()).get(CHAT_COOKIE)?.value;
  // Redis niedostępny = pusta rozmowa zamiast błędu całej strony.
  const history = id && isChatId(id) ? await loadHistory(id).catch(() => []) : [];
  return <Chat initialMessages={history} notFound={NOT_FOUND} />;
}
