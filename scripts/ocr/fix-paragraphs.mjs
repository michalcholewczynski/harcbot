// Naprawia znaczniki paragrafów źle rozpoznane przez OCR: "51" → "§ 1", "5 10" → "§ 10", "s2" → "§ 2", "821" → "§ 21".
// Użycie: node scripts/ocr/fix-paragraphs.mjs data/text/Statut-ZHP.ocr.txt data/text/Statut-ZHP.txt
// Jednorazowy krok przed ręczną korektą — ponowne uruchomienie nadpisze plik wyjściowy.
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Sprawdza, czy linia to (źle odczytany) znacznik paragrafu.
 * @param {string} line      linia tekstu bez białych znaków na brzegach, np. "5 10", "821", "s2"
 * @param {number} expected  numer paragrafu, którego spodziewamy się jako następnego
 * @returns {number | null}  numer paragrafu, jeśli linia jest znacznikiem; w przeciwnym razie null
 */
export function parseParagraphMarker(line, expected) {
  const prefixes = ["5", "8", "s", "6", "§"]
  if (line.length > 4) {
    return null;
  }
  for (const candidate of [expected, expected + 1, expected + 2]) {
    if (line.endsWith(String(candidate))) {
      const candidateLen = String(candidate).length;
      const prefix = (line.slice(0, -candidateLen)).trim();
      if (prefixes.includes(prefix)) {
         return candidate;
      }
    }
  }
  return null;
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Użycie: node fix-paragraphs.mjs <wejście.ocr.txt> <wyjście.txt>');
  process.exit(1);
}

let expected = 1;
const gaps = [];
const lines = readFileSync(input, 'utf8').split('\n').map((line) => {
  const n = parseParagraphMarker(line.trim(), expected);
  if (n === null) return line;
  for (let k = expected; k < n; k++) gaps.push(k); // paragrafy pominięte przez parser
  expected = n + 1;
  return `§ ${n}`;
});

writeFileSync(output, lines.join('\n'));
if (expected === 1) {
  console.error('Nie znaleziono żadnego znacznika § — sprawdź parseParagraphMarker');
  process.exit(1);
}
console.log(`Ostatni znaleziony: § ${expected - 1}`);
console.log(gaps.length ? `Brakujące (do ręcznej korekty): § ${gaps.join(', § ')}` : 'Brak luk w numeracji ✓');
