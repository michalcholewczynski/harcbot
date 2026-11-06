// Testy oceny odpowiedzi. Dopóki scoreAnswer jest pusta, część z nich nie przechodzi: to oczekiwane.
// Użycie: node --test eval/score-answer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAnswer } from './score-answer.mjs';
import { NOT_FOUND } from '../lib/rag.mjs';

test('trafna odpowiedź innymi słowami i w innej kolejności', () => {
  const expected = 'Fizycznej, intelektualnej, duchowej, emocjonalnej i społecznej';
  const answer = 'Rozwój powinien obejmować sferę społeczną, emocjonalną, duchową, intelektualną i fizyczną.';
  assert.equal(scoreAnswer(answer, expected), true);
});

test('cytaty [n] w środku zdania nie przeszkadzają', () => {
  assert.equal(scoreAnswer('Hasła filaretów to Ojczyzna [1], Nauka [1] i Cnota [2].', 'Ojczyzna, nauka, cnota'), true);
});

test('wielkie litery i polskie znaki', () => {
  assert.equal(scoreAnswer('ZUCH KOCHA POLSKĘ I CZYNI DOBRO [1].', 'Zuch kocha Polskę i czyni dobro'), true);
});

test('długa wzorcowa odpowiedź, model streszcza ją innymi słowami (prawdziwa odpowiedź Gemini na Q9)', () => {
  const expected = 'Poczekać kilka dni lub zapytać drużynowego, jak często dane są wprowadzane do systemu – w zależności od hufca robi się to np. co dwa dni, raz w tygodniu lub rzadziej.';
  const answer = 'Jeśli w systemie Tipi widnieje status „Oczekuje na zatwierdzenie”, należy poczekać kilka dni, ponieważ czas wprowadzania danych przez hufiec może być różny [1]. Jeśli po tym czasie status się nie zmieni, skontaktuj się z drużynowym i zapytaj, jak często dane są wprowadzane do systemu [1].';
  assert.equal(scoreAnswer(answer, expected), true);
});

test('zła odpowiedź', () => {
  const expected = 'Płatność błyskawiczną z wykorzystaniem systemu Tipi i PayNow';
  assert.equal(scoreAnswer('ZHP rekomenduje płatność gotówką u skarbnika hufca [3].', expected), false);
});

test('model odmówił, choć odpowiedź jest w dokumentach', () => {
  assert.equal(scoreAnswer(NOT_FOUND, 'Ojczyzna, nauka, cnota'), false);
});

test('pułapka: model poprawnie odpowiada NOT_FOUND', () => {
  assert.equal(scoreAnswer(NOT_FOUND, NOT_FOUND), true);
});

test('pułapka: model coś zmyślił', () => {
  assert.equal(scoreAnswer('Roczna składka w ZHP kosztuje 120 zł [2].', NOT_FOUND), false);
});
