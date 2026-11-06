// Użycie: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPages, packLines, chunkDocument } from './chunk-docs.mjs';

test('splitPages czyta numery stron', () => {
  const pages = splitPages('\n=== strona 1 ===\nA\n\n=== strona 2 ===\nB\n');
  assert.deepEqual(pages.map((p) => p.page), [1, 2]);
  assert.equal(pages[1].text.trim(), 'B');
});

test('splitPages: dokument bez stron ma page = null', () => {
  assert.deepEqual(splitPages('tylko tekst'), [{ page: null, text: 'tylko tekst' }]);
});

test('packLines skleja linie do limitu i nie gubi tekstu', () => {
  assert.deepEqual(packLines(['aaaa', 'bbbb', 'cc'], 9), ['aaaa\nbbbb', 'cc']);
  assert.deepEqual(packLines(['x'.repeat(20), 'y'], 5), ['x'.repeat(20), 'y']); // za długa linia zostaje cała
  assert.deepEqual(packLines([], 5), []);
});

test('fragment nie przekracza granicy strony', () => {
  const chunks = chunkDocument('f.txt', '=== strona 1 ===\nA\n=== strona 2 ===\nB\n', 1000);
  assert.deepEqual(chunks.map((c) => [c.page, c.text]), [[1, 'A'], [2, 'B']]);
});

test('akapit, który się nie mieści, przechodzi w całości do następnego fragmentu', () => {
  const chunks = chunkDocument('f.txt', 'aaaa\n\nbb\ncc\n\ndd', 9);
  assert.deepEqual(chunks.map((c) => c.text), ['aaaa', 'bb\ncc\ndd']);
});

test('za długi akapit dzieli się po liniach', () => {
  const chunks = chunkDocument('f.txt', 'aaaa\nbbbb\ncccc', 9);
  assert.deepEqual(chunks.map((c) => c.text), ['aaaa\nbbbb', 'cccc']);
});
