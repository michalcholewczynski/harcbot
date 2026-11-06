// OCR zeskanowanego PDF do tekstu z markerami stron.
// Użycie: node scripts/ocr/ocr-pdf.mjs <plik.pdf> <wynik.txt>
// Wymaga: pdftoppm (poppler). Dane języka polskiego tesseract.js pobiera przy pierwszym uruchomieniu.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';

const [pdf, out] = process.argv.slice(2);
if (!pdf || !out) {
  console.error('Użycie: node ocr-pdf.mjs <plik.pdf> <wynik.txt>');
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'ocr-'));
try {
  // 300 dpi w skali szarości — rozdzielczość, przy której tesseract najlepiej czyta drobny druk
  execFileSync('pdftoppm', ['-r', '300', '-gray', '-png', pdf, join(tmp, 'p')]);
  const pages = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort(); // pdftoppm dopełnia numery zerami

  const cachePath = join(dirname(fileURLToPath(import.meta.url)), '.cache');
  const worker = await createWorker('pol', 1, { cachePath });
  const parts = [];
  for (const [i, page] of pages.entries()) {
    const { data } = await worker.recognize(join(tmp, page));
    parts.push(`=== strona ${i + 1} ===\n${data.text.trim()}`);
    console.log(`strona ${i + 1}/${pages.length}, pewność ${Math.round(data.confidence)}%`);
  }
  await worker.terminate();

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, parts.join('\n\n') + '\n');
  console.log(`Zapisano ${out}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
