// Odpowiada na pytanie na podstawie dokumentów ZHP: BM25 szuka fragmentów, Gemini pisze odpowiedź z cytatami.
// Użycie: node --env-file=.env scripts/ask.mjs "Jaki jest pierwszy punkt Prawa Zucha?"
// Darmowe modele i limity: aistudio.google.com/rate-limit (inny model: GEMINI_MODEL=...)
import { answer, sourceLabel } from '../lib/rag.mjs';

const question = process.argv.slice(2).join(' ').trim();
if (!question) {
  console.error('Podaj pytanie, np.: node --env-file=.env scripts/ask.mjs "Jaka jest misja ZHP?"');
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error('Brak GEMINI_API_KEY. Dodaj go do pliku .env i uruchom z flagą --env-file=.env');
  process.exit(1);
}

try {
  const { text, results } = await answer(question);
  console.log(text);
  // Numery [1]..[K] mapujemy na pliki w kodzie, więc model nie może wymyślić nazwy dokumentu.
  if (results.length) console.log('\nŹródła:');
  results.forEach((r, i) => console.log(`[${i + 1}] ${sourceLabel(r.doc)}`));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
