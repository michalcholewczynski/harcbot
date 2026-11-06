// Użycie: node --test eval/sources.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSource, citedDocs, citationsOk } from './sources.mjs';

const statut = (page) => ({ doc: { file: 'Statut-ZHP.txt', page, text: '...' } });
const results = [statut(3), statut(7), statut(20)];

test('parseSource: nazwa oryginału → plik tekstowy i zakres stron', () => {
  assert.deepEqual(parseSource('Statut-ZHP-po-44.-Zjezdzie.pdf, s. 4-7'), { file: 'Statut-ZHP.txt', from: 4, to: 7 });
  assert.equal(parseSource('brak'), null);
});

test('citedDocs: [n] i [n, m], bez powtórzeń, numer spoza listy → null', () => {
  const docs = citedDocs('Ojczyzna [2], nauka [1, 2] i cnota [9].', results);
  assert.deepEqual(docs, [results[1].doc, results[0].doc, null]);
});

test('citationsOk: zwykłe pytanie', () => {
  const target = parseSource('Statut-ZHP-po-44.-Zjezdzie.pdf, s. 7');
  assert.equal(citationsOk('Hasła to Ojczyzna, Nauka, Cnota [2].', results, target), true);
  assert.equal(citationsOk('Hasła to Ojczyzna, Nauka, Cnota [3].', results, target), false); // zła strona
  assert.equal(citationsOk('Hasła to Ojczyzna, Nauka, Cnota.', results, target), false); // brak cytatu
  assert.equal(citationsOk('Hasła to Ojczyzna [2], Nauka, Cnota [8].', results, target), false); // zmyślony numer
});

test('citationsOk: pułapka nie może mieć cytatów', () => {
  assert.equal(citationsOk('Nie znalazłem tego w dokumentach.', results, null), true);
  assert.equal(citationsOk('Składka kosztuje 120 zł [1].', results, null), false);
});
