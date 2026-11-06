#!/usr/bin/env bash
# Wyciąga tekst z dokumentów, które mają warstwę tekstową (bez OCR), do data/text/.
# Strony PDF są oznaczone "=== strona N ===" jak w Statucie, żeby cytaty mogły linkować do #page=N.
# Statut (skan) ma osobną ścieżkę: scripts/ocr/.
# Użycie: bash scripts/extract-text.sh   (wymaga poppler: pdftotext, pdfinfo)
# shortcut: textutil jest tylko na macOS; na innym systemie zamień go na pandoc albo mammoth.
set -euo pipefail
cd "$(dirname "$0")/.."
out=data/text
mkdir -p "$out"

pdf_to_text() { # $1 = plik PDF, $2 = plik wynikowy
  local pages
  pages=$(pdfinfo "$1" 2>/dev/null | awk '/^Pages:/ {print $2}')
  for ((i = 1; i <= pages; i++)); do
    echo "=== strona $i ==="
    # bez -layout: przy Polityce tryb -layout zwraca pusty tekst; tr usuwa znak końca strony
    pdftotext -f "$i" -l "$i" "$1" - 2>/dev/null | tr -d '\f'
    echo
  done > "$2"
  echo "$2: $pages stron"
}

pdf_to_text data/sources/2026-polityka-ochrony-*.pdf "$out/Polityka-Safe-from-Harm.txt"
pdf_to_text data/sources/TiPi-instrukcja_jak-oplacic-skladki_*.pdf "$out/TiPi-oplacanie-skladek.txt"
pdf_to_text data/sources/TiPi-instrukcja_uzyskanie-dostepu-*.pdf "$out/TiPi-uzyskanie-dostepu.txt"

textutil -convert txt -stdout data/sources/Podstawy_Wychowawcze_ZHP_*.docx > "$out/Podstawy-Wychowawcze.txt"
echo "$out/Podstawy-Wychowawcze.txt: z .docx (bez stron)"
