// Zadaje Gemini każde gotowe pytanie i sprawdza (a) treść odpowiedzi, (b) czy cytaty [n] wskazują właściwe źródło.
// Użycie: node --env-file=.env eval/run-answers.mjs [plik z pytaniami, domyślnie eval/questions.md]
// Pauza między pytaniami: EVAL_DELAY_MS (domyślnie 5000), bo darmowy Gemini ma limit zapytań na minutę.
import { setTimeout as sleep } from 'node:timers/promises';
import { loadQuestions } from './parse-questions.mjs';
import { parseSource, citationsOk } from './sources.mjs';
import { scoreAnswer } from './score-answer.mjs';
import { MODEL, answer } from '../lib/rag.mjs';

const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 5000);
const mark = (ok) => (ok ? '✓' : '✗');

console.log(`Model: ${MODEL}\n`); // wynik evala ma sens tylko z nazwą modelu (GEMINI_MODEL w .env go podmienia)

const questions = loadQuestions(process.argv[2]);
let goodAnswers = 0;
let goodCitations = 0;
let apiErrors = 0;
for (const [i, q] of questions.entries()) {
  if (i > 0) await sleep(DELAY_MS);
  try {
    const { text, results } = await answer(q.question);
    const answerOk = scoreAnswer(text, q.answer); // dla pułapek q.answer to NOT_FOUND
    const citeOk = citationsOk(text, results, parseSource(q.source));
    if (answerOk) goodAnswers++;
    if (citeOk) goodCitations++;
    console.log(`${q.id.padEnd(4)} odp ${mark(answerOk)}  cyt ${mark(citeOk)}  ${q.question}`);
  } catch (err) {
    apiErrors++; // jeden błąd (429, 503, timeout) nie przerywa całego przebiegu
    console.log(`${q.id.padEnd(4)} ! błąd API: ${err.message.slice(0, 120)}`);
  }
}
const n = questions.length;
console.log(`\nPoprawne odpowiedzi: ${goodAnswers}/${n}\nPoprawne cytaty: ${goodCitations}/${n}\nBłędy API: ${apiErrors}`);
