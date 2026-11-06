// Sprawdza, czy wyszukiwanie BM25 zwraca w pierwszych K wynikach fragment z właściwego pliku i strony.
// Użycie: node scripts/chunk-docs.mjs && node eval/run-retrieval.mjs [plik z pytaniami, domyślnie eval/questions.md]
import { readFileSync } from 'node:fs';
import { loadQuestions } from './parse-questions.mjs';
import { parseSource, isRelevant } from './sources.mjs';
import { buildIndex, search } from '../lib/bm25.mjs';

const K = 5;

const index = buildIndex(JSON.parse(readFileSync(new URL('../data/chunks.json', import.meta.url), 'utf8')));
let hits = 0;
let traps = 0;
const questions = loadQuestions(process.argv[2]);
for (const q of questions) {
  const target = parseSource(q.source);
  if (target === null) { traps++; continue; } // pułapka: nie ma czego szukać, sprawdza ją dopiero run-answers
  const results = search(index, q.question, K);
  const rank = results.findIndex((r) => isRelevant(r.doc, target)) + 1; // 0 = nie znaleziono
  if (rank) hits++;
  console.log(`${q.id.padEnd(4)} ${rank ? `✓ miejsce ${rank}` : '✗ brak w top-' + K}  ${q.question}`);
}
console.log(`\nTrafione w top-${K}: ${hits}/${questions.length - traps}`);
if (traps) console.log(`Pominięte pułapki (Źródło: brak): ${traps}`);
