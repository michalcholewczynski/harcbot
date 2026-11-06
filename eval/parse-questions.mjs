// Wczytuje eval/questions.md jako listę obiektów { id, question, answer, source, category }.
// Użycie: node eval/parse-questions.mjs   (wypisuje, ile pytań jest gotowych)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Zamienia treść questions.md na listę pytań (także tych jeszcze nieuzupełnionych).
 * @param {string} markdown  zawartość pliku, bloki zaczynają się od "## Q1", "## Q2"...
 */
export function parseQuestions(markdown) {
  return markdown.split(/^## /m).slice(1).map((block) => {
    const [id, ...lines] = block.split('\n');
    const field = (name) => {
      const prefix = `- **${name}:**`;
      const line = lines.find((l) => l.startsWith(prefix));
      return line ? line.slice(prefix.length).trim() : '';
    };
    return {
      id: id.trim(),
      question: field('Pytanie'),
      answer: field('Odpowiedź'),
      source: field('Źródło'),
      category: field('Kategoria'),
    };
  });
}

/**
 * Czy pytanie nadaje się do testu? Pytania Q11+ będą dopisywane później,
 * więc w pliku mogą być puste bloki — parser musi wiedzieć, co z nimi zrobić.
 * @param {{ question: string, answer: string, source: string, category: string }} q
 * @returns {boolean}
 */
export function isComplete(q) {
  if (q.question.trim() === '' || q.answer.trim() === '' || q.source.trim() === '') return false;
  return true;
}

export function loadQuestions(path = new URL('./questions.md', import.meta.url)) {
  return parseQuestions(readFileSync(path, 'utf8')).filter(isComplete);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = parseQuestions(readFileSync(new URL('./questions.md', import.meta.url), 'utf8'));
  const ready = all.filter(isComplete);
  console.log(`Pytań w pliku: ${all.length}, gotowych do testu: ${ready.length}`);
  for (const q of ready) console.log(`${q.id}: ${q.question}  [${q.category}]`);
}
