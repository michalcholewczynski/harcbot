// Ocena odpowiedzi modelu: czy mówi to samo, co odpowiedź wzorcowa z questions.md.
import { tokenize } from '../lib/bm25.mjs';
import { NOT_FOUND } from '../lib/rag.mjs';

// Jaka część słów wzorca musi być w odpowiedzi. 1.0 odrzucałoby dobre odpowiedzi pisane innymi słowami.
// 0.5, bo przy 0.6 poprawne odpowiedzi Gemini na Q5/Q6/Q9 wypadały na 0.56–0.57 (brakowało tylko słów typu "jeśli", "lub", "nie").
// shortcut: próg dobrany na 10 pytaniach; po przeniesieniu Q11–Q25 sprawdź, czy dalej odróżnia dobre odpowiedzi od złych.
const THRESHOLD = 0.5;

/**
 * Sprawdza, czy odpowiedź modelu zgadza się z odpowiedzią oczekiwaną.
 *
 * Odpowiedź modelu może być sformułowana innymi słowami, w innej kolejności,
 * innymi wielkimi/małymi literami i zawiera cytaty w nawiasach, np. "[1]".
 * Dla pytań-pułapek oczekiwana odpowiedź to NOT_FOUND z lib/rag.mjs
 * ("Nie znalazłem tego w dokumentach."): wtedy model ma odmówić, a nie coś zmyślić.
 * Przydać się może tokenize() z lib/bm25.mjs (dzieli tekst na słowa i skraca je do rdzeni).
 *
 * @param {string} answerText      tekst odpowiedzi modelu, np. "Hasła to Ojczyzna [1], Nauka i Cnota [2]."
 * @param {string} expectedAnswer  odpowiedź wzorcowa z pola "Odpowiedź", np. "Ojczyzna, nauka, cnota"
 * @returns {boolean}  true, gdy odpowiedź jest poprawna
 *
 * @example
 * scoreAnswer('Hasła to Ojczyzna [1], Nauka i Cnota [2].', 'Ojczyzna, nauka, cnota'); // true
 * scoreAnswer('ZHP poleca płatność gotówką [3].', 'Płatność błyskawiczną PayNow'); // false
 * scoreAnswer('Nie znalazłem tego w dokumentach.', 'Nie znalazłem tego w dokumentach.'); // true
 * scoreAnswer('Składka kosztuje 120 zł [2].', 'Nie znalazłem tego w dokumentach.'); // false
 */
export function scoreAnswer(answerText, expectedAnswer) {
  // Model może pominąć kropkę albo zmienić wielkość liter, więc szukamy samej frazy.
  const refused = answerText.toLowerCase().includes(NOT_FOUND.replace(/\.$/, '').toLowerCase());
  if (expectedAnswer === NOT_FOUND) return refused; // pułapka: poprawna jest tylko odmowa
  if (refused) return false; // odpowiedź jest w dokumentach, a model odmówił

  const answerWords = new Set(tokenize(answerText)); // tokenize: małe litery, bez "[1]", rdzenie słów
  const expectedWords = tokenize(expectedAnswer).filter((w) => w.length > 2); // "i", "w", "z" niczego nie dowodzą
  const found = expectedWords.filter((w) => answerWords.has(w)).length;
  return expectedWords.length > 0 && found / expectedWords.length >= THRESHOLD;
}
