// Tnie teksty z data/text/ na fragmenty { id, file, page, text } i zapisuje je do data/chunks.json.
// Fragment nigdy nie przekracza granicy strony, więc numer strony w cytacie jest dokładny.
// Użycie: node scripts/chunk-docs.mjs   (najpierw: bash scripts/extract-text.sh)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Statut-ZHP.ocr.txt pomijamy — to surowy OCR, poprawiona wersja to Statut-ZHP.txt.
const FILES = [
  'Statut-ZHP.txt',
  'Polityka-Safe-from-Harm.txt',
  'Podstawy-Wychowawcze.txt',
  'TiPi-oplacanie-skladek.txt',
  'TiPi-uzyskanie-dostepu.txt',
];
const MAX_CHARS = 1000;

/**
 * Dzieli tekst po znacznikach "=== strona N ===".
 * @param {string} text
 * @returns {{ page: number | null, text: string }[]}  page = null, gdy dokument nie ma stron (.docx)
 */
export function splitPages(text) {
  const parts = text.split(/^=== strona (\d+) ===$/m); // [przed, "1", treść1, "2", treść2, ...]
  if (parts.length === 1) return [{ page: null, text }];
  const pages = [];
  for (let i = 1; i < parts.length; i += 2) pages.push({ page: Number(parts[i]), text: parts[i + 1] });
  return pages;
}

/**
 * Skleja kolejne linie (łącznik: "\n") w fragmenty nie dłuższe niż maxChars.
 * @param {string[]} lines     niepuste linie jednej strony, po kolei
 * @param {number} maxChars
 * @returns {string[]}         fragmenty; jedna linia dłuższa niż maxChars zostaje sama, w całości
 */
export function packLines(lines, maxChars) {
  const chunks = [];
  let current = '';
  lines.forEach(line => {
    if (current === '') {
      current = line;
    } else {
      let next = current + '\n' + line;
      if (next.length > maxChars) {
        chunks.push(current);
        current = line;
      } else {
        current = next;
      }
    }
  });
  if (current != '') {
    chunks.push(current);
  }
  return chunks;
}

export function chunkDocument(file, text, maxChars = MAX_CHARS) {
  return splitPages(text).flatMap(({ page, text }) => {
    // Pakujemy całe akapity (pusta linia = granica), żeby nie ciąć zdania w połowie; za długi akapit wraca do pojedynczych linii.
    const paras = text
      .split(/\n\s*\n/)
      .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join('\n'))
      .filter(Boolean)
      .flatMap((p) => (p.length > maxChars ? p.split('\n') : [p]));
    return packLines(paras, maxChars).map((t) => ({ file, page, text: t }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = new URL('../data/text/', import.meta.url);
  const chunks = FILES.flatMap((file) => chunkDocument(file, readFileSync(new URL(file, dir), 'utf8')));
  chunks.forEach((c, i) => (c.id = i)); // id po kolei dla całego korpusu
  writeFileSync(new URL('../data/chunks.json', import.meta.url), JSON.stringify(chunks, null, 1));
  for (const file of FILES) {
    const own = chunks.filter((c) => c.file === file);
    const longest = Math.max(...own.map((c) => c.text.length));
    console.log(`${file}: ${own.length} fragmentów, najdłuższy ${longest} znaków`);
  }
  console.log(`Razem: ${chunks.length} fragmentów → data/chunks.json`);
}
