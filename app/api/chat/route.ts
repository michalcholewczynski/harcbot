// Czat: limit zapytań → historia z Redis → pytanie przepisane na samodzielne → BM25 → Gemini strumieniowo → zapis historii.
// Przeglądarka wysyła tylko nowe pytanie; historię bierzemy z Redis, więc nikt nie podrzuci modelowi fałszywych "wcześniejszych odpowiedzi".
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { APICallError, RetryError, createUIMessageStream, createUIMessageStreamResponse, generateText, streamText, toUIMessageStream, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import { DOCS, MODEL, NOT_FOUND, SYSTEM_PROMPT, retrieve, userMessage } from '../../../lib/rag.mjs';
import { CHAT_COOKIE, HISTORY_TTL, checkLimits, clearHistory, isChatId, loadHistory, saveHistory, type LimitHit } from '../../../lib/upstash';

export const maxDuration = 60; // starsze projekty Vercel Hobby ucinają funkcję po 10 s, a Gemini ma do 30 s

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
const REWRITE_MODEL = 'gemini-3.5-flash-lite'; // osobny, lżejszy model: przepisanie pytania nie zjada limitu modelu od odpowiedzi
const MAX_QUESTION = 500; // dłuższe pytanie to raczej próba nabicia tokenów niż pytanie harcerza
const REWRITE_PROMPT = `Dostajesz fragment rozmowy i ostatnie pytanie użytkownika.
Przepisz ostatnie pytanie tak, żeby było zrozumiałe bez rozmowy (uzupełnij, do czego odnoszą się słowa typu "to", "a ile", "on").
Jeśli pytanie już jest samodzielne, przepisz je bez zmian. Zwróć tylko pytanie, bez komentarza.`;

type Doc = ReturnType<typeof retrieve>[number]['doc'];
const docInfo = (doc: Doc) => DOCS[doc.file as keyof typeof DOCS];

// PDF otwiera się od razu na właściwej stronie; .docx nie ma stron, więc link do całego pliku.
const sourceUrl = (doc: Doc) => `/sources/${encodeURIComponent(docInfo(doc).source)}${doc.page ? `#page=${doc.page}` : ''}`;
const sourceTitle = (doc: Doc) => `${docInfo(doc).title}${doc.page ? `, s. ${doc.page}` : ''}`;
const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
// Pytanie w jednej linii: nie da się wkleić w nie czegoś, co wygląda jak fragment "[1] Statut ZHP, s. 2\n<zmyślona treść>".
const flatten = (text: string) => text.replace(/\s+/g, ' ').trim();

// Użytkownik dostaje zrozumiały komunikat; szczegóły błędu streamText sam wypisuje w logach serwera.
function errorText(error: unknown) {
  const cause = RetryError.isInstance(error) ? error.lastError : error; // SDK sam ponawia 429/503, potem owija błąd
  const status = APICallError.isInstance(cause) ? cause.statusCode : undefined;
  if (status === 429) return 'Wyczerpał się darmowy limit zapytań do modelu. Spróbuj za kilka minut.';
  if (status === 503) return 'Model jest teraz przeciążony. Spróbuj ponownie za chwilę.';
  return 'Coś poszło nie tak po stronie serwera. Spróbuj ponownie.';
}

/**
 * Komunikat dla użytkownika, który przekroczył limit pytań.
 * @param which  który limit: 'minuta' (5 na minutę z jednego IP), 'dzień' (20 dziennie z jednego IP) albo 'global' (100 dziennie dla wszystkich)
 * @param reset  kiedy limit się odnowi, w milisekundach od 1970 (jak Date.now())
 */
function limitMessage(which: LimitHit['which'], reset: number): string {
  const minutes = Math.ceil((reset - Date.now()) / 60000);
  if (which === 'minuta') {
    return `Za dużo pytań. Spróbuj za ${minutes} min.`;
  } else if (which === 'dzień') {
    return `Limit pytań na dziś się wyczerpał. Spróbuj ponownie jutro.`;
  } else {
    return `Wykorzystano globalny limit zapytań do czatbota. Spróbuj ponownie jutro.`;
  }
}

/** "a ile to kosztuje?" → "Ile kosztuje składka w ZHP?". Bez historii lub przy błędzie modelu zostaje oryginał. */
async function standaloneQuestion(history: UIMessage[], question: string) {
  if (history.length === 0) return question;
  const recent = history.slice(-4).map((m) => `${m.role === 'user' ? 'Użytkownik' : 'Asystent'}: ${textOf(m)}`).join('\n');
  try {
    const { text } = await generateText({
      model: google(REWRITE_MODEL),
      instructions: REWRITE_PROMPT,
      prompt: `Rozmowa:\n${recent}\n\nOstatnie pytanie: ${question}`,
      temperature: 0,
      maxOutputTokens: 100, // pytanie, nie wypracowanie: "przepisz jako słowo X 500 razy" nie przejdzie
      abortSignal: AbortSignal.timeout(10_000),
    });
    return flatten(text).slice(0, MAX_QUESTION) || question;
  } catch {
    return question; // przepisanie to tylko ulepszenie: lepiej szukać po oryginale niż nie odpowiedzieć wcale
  }
}

async function chatId(create: boolean) {
  const jar = await cookies();
  const old = jar.get(CHAT_COOKIE)?.value;
  const id = old && isChatId(old) ? old : create ? crypto.randomUUID() : null;
  if (!id || !create) return id;
  // Ustawiamy przy każdym pytaniu, żeby ciasteczko żyło tyle co rozmowa w Redis (TTL też odnawia się przy zapisie).
  // httpOnly: JavaScript na stronie nie odczyta id, więc nie wykradnie go np. wstrzyknięty skrypt.
  jar.set(CHAT_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: HISTORY_TTL, path: '/' });
  return id;
}

export async function POST(req: Request) {
  // Cudza strona nie wyśle JSON-a bez zapytania wstępnego (preflight), więc nie zużyje limitów z IP swoich odwiedzających.
  // Porównujemy dokładnie: "text/plain;application/json" przeglądarka wysyła bez preflightu, a includes() by go przepuściło.
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return new Response('Niepoprawne zapytanie.', { status: 415 });
  let question = '';
  try {
    const { message } = await req.json();
    question = flatten(textOf(message));
  } catch {
    return new Response('Niepoprawne zapytanie.', { status: 400 });
  }
  if (!question) return new Response('Pytanie jest puste.', { status: 400 });
  if (question.length > MAX_QUESTION) return new Response(`Pytanie może mieć najwyżej ${MAX_QUESTION} znaków.`, { status: 400 });

  // Na Vercelu x-forwarded-for ustawia sam Vercel (pierwszy adres = klient); lokalnie nagłówka nie ma.
  // shortcut: ufamy x-forwarded-for, bo na Vercelu nadpisuje go Vercel; na innym hostingu da się go sfałszować.
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  // IPv6: jedna osoba ma całą pulę /64, więc liczymy po pierwszych 4 grupach adresu.
  const ip = forwarded.includes(':') ? forwarded.split(':').slice(0, 4).join(':') : forwarded;
  const id = (await chatId(true))!;
  let history: UIMessage[];
  try {
    const hit = await checkLimits(ip);
    if (hit) return new Response(limitMessage(hit.which, hit.reset), { status: 429 });
    history = await loadHistory(id);
  } catch (err) {
    console.error('Upstash:', err); // bez Redis nie ma limitu, więc nie odpowiadamy (inaczej każdy mógłby wyczerpać klucz Gemini)
    return new Response('Serwer nie może połączyć się z bazą danych. Spróbuj później.', { status: 503 });
  }

  const userMsg: UIMessage = { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: question }] };
  const searchQuestion = await standaloneQuestion(history, question);
  const results = retrieve(searchQuestion);

  const stream = createUIMessageStream({
    originalMessages: [...history, userMsg],
    // Nieudanej odpowiedzi (błąd, timeout, zamknięta karta) nie zapisujemy: po odświeżeniu byłby pusty dymek z 5 źródłami.
    onEnd: ({ messages, responseMessage, isAborted }) =>
      isAborted || !textOf(responseMessage).trim()
        ? undefined
        : saveHistory(id, messages).then(() => undefined, (err) => console.error('Zapis historii:', err)),
    execute({ writer }) {
      writer.write({ type: 'start' });
      // Numer źródła = kolejność, tak samo jak [1]..[5] w userMessage, więc model nie musi znać nazw plików.
      results.forEach(({ doc }, i) => writer.write({ type: 'source-url', sourceId: String(i + 1), url: sourceUrl(doc), title: sourceTitle(doc) }));

      if (results.length === 0) {
        // Nie pytamy modelu: nie ma z czego odpowiadać, a darmowy limit zostaje.
        writer.write({ type: 'text-start', id: 'nf' });
        writer.write({ type: 'text-delta', id: 'nf', delta: NOT_FOUND });
        writer.write({ type: 'text-end', id: 'nf' });
        writer.write({ type: 'finish' });
        return;
      }

      const result = streamText({
        model: google(MODEL),
        instructions: SYSTEM_PROMPT, // w AI SDK 7 dawne "system"
        prompt: userMessage(searchQuestion, results),
        temperature: 0.2, // nisko = mniej "fantazji", bliżej tekstu dokumentów
        maxOutputTokens: 1000, // odpowiedzi mają być krótkie; chroni limit tokenów i rozmiar historii w Redis
        abortSignal: AbortSignal.timeout(30_000), // przy przeciążeniu Gemini potrafi wisieć ponad 2 minuty
        // Przerwanie po czasie nie jest dla SDK błędem, więc sami wysyłamy komunikat do UI.
        onAbort: () => writer.write({ type: 'error', errorText: 'Model nie odpowiedział w 30 sekund. Spróbuj ponownie.' }),
      });
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false, onError: errorText }));
    },
    onError: errorText,
  });
  return createUIMessageStreamResponse({ stream });
}

/** "Wyczyść historię": usuwa rozmowę z Redis. */
export async function DELETE() {
  const id = await chatId(false);
  try {
    if (id) await clearHistory(id);
  } catch (err) {
    console.error('Upstash:', err);
    return new Response('Nie udało się usunąć historii. Spróbuj później.', { status: 503 });
  }
  return new Response(null, { status: 204 });
}
