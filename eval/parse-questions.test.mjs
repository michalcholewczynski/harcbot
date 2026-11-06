// Użycie: node --test eval/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestions, isComplete } from './parse-questions.mjs';

const sample = `## Q1
- **Pytanie:** Jak masz na imię?
- **Odpowiedź:** Zuch
- **Źródło:** plik.pdf, s. 1
- **Kategoria:** test

## Q2
- **Pytanie:**
- **Odpowiedź:**
- **Źródło:**
- **Kategoria:**
`;

test('parser czyta pola z bloku', () => {
  const [q1, q2] = parseQuestions(sample);
  assert.deepEqual(q1, { id: 'Q1', question: 'Jak masz na imię?', answer: 'Zuch', source: 'plik.pdf, s. 1', category: 'test' });
  assert.equal(q2.question, '');
});

test('isComplete odrzuca pusty blok i przepuszcza wypełniony', () => {
  const [q1, q2] = parseQuestions(sample);
  assert.equal(isComplete(q1), true);
  assert.equal(isComplete(q2), false);
});
