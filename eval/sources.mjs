// Wspólne dla run-retrieval i run-answers: skąd powinna pochodzić odpowiedź i czy fragment/cytat do niej pasuje.
import { DOCS } from '../lib/rag.mjs';

/**
 * "Statut-...pdf, s. 4-7" → { file: 'Statut-ZHP.txt', from: 4, to: 7 }.
 * Dla pytań-pułapek ("Źródło: brak") zwraca null: odpowiedzi nie ma w żadnym dokumencie.
 */
export function parseSource(source) {
  if (source.trim().toLowerCase() === 'brak') return null;
  // DOCS mapuje plik tekstowy na nazwę oryginału, a w questions.md piszemy nazwę oryginału.
  const file = Object.keys(DOCS).find((f) => source.startsWith(DOCS[f].source));
  const [, from, to] = source.match(/s\.\s*(\d+)(?:-(\d+))?/) ?? [];
  return { file, from: Number(from), to: Number(to ?? from) };
}

// shortcut: dla dokumentów bez stron (.docx, page = null) liczy się sam plik; przy większej liczbie takich plików dodaj dopasowanie po tekście.
export const isRelevant = (chunk, { file, from, to }) =>
  chunk.file === file && (chunk.page === null || (chunk.page >= from && chunk.page <= to));

/**
 * Fragmenty, które model zacytował w odpowiedzi. "[2]" → results[1].doc; "[1, 3]" też działa.
 * Numer spoza listy (np. [7] przy 5 fragmentach) daje null, żeby było widać zmyślony cytat.
 */
export function citedDocs(text, results) {
  const numbers = [...text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((m) => m[1].split(',').map(Number));
  return [...new Set(numbers)].map((n) => results[n - 1]?.doc ?? null);
}

/**
 * Czy cytaty są poprawne? Pułapka (target = null): żadnego cytatu.
 * Zwykłe pytanie: jest choć jeden cytat, żaden nie jest zmyślony i choć jeden wskazuje właściwy plik/stronę.
 */
export function citationsOk(text, results, target) {
  const docs = citedDocs(text, results);
  if (target === null) return docs.length === 0;
  return docs.length > 0 && !docs.includes(null) && docs.some((d) => isRelevant(d, target));
}
