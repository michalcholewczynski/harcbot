// Użycie: node --test lib/bm25.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stem, tokenize, buildIndex, search } from './bm25.mjs';

test('tokenize tnie na słowa, małe litery, polskie znaki', () => {
  assert.equal(tokenize('Zuch kocha Polskę, i czyni dobro!').length, 6);
});

test('tokenize: odmiana z ogonkiem i bez daje ten sam token', () => {
  assert.deepEqual(tokenize('Misją'), tokenize('misja'));
});

test('stem: odmiana tego samego słowa daje ten sam rdzeń', () => {
  assert.equal(stem('składki'), stem('składkę'));
  assert.equal(stem('składką'), stem('składkę'));
});

test('search stawia najtrafniejszy fragment pierwszy', () => {
  const index = buildIndex([{ text: 'Zuch kocha Polskę' }, { text: 'Opłać składkę przez PayNow' }, { text: 'Statut ZHP' }]);
  assert.equal(search(index, 'jak opłacić składkę', 3)[0].doc.text, 'Opłać składkę przez PayNow');
});

test('search: zapytanie bez trafień daje pustą listę', () => {
  assert.deepEqual(search(buildIndex([{ text: 'abc' }]), 'xyz'), []);
});
