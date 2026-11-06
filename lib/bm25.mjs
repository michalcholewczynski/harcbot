// Wyszukiwanie BM25 po fragmentach (data/chunks.json). Bez zależności, działa lokalnie.
// shortcut: indeks w pamięci i przeliczany przy każdym uruchomieniu, wystarczy dla kilkuset fragmentów; przy tysiącach zapisz go do pliku.
const K1 = 1.5; // jak szybko kolejne wystąpienie słowa przestaje podnosić wynik
const B = 0.75; // jak mocno karzemy długie fragmenty

/**
 * Sprowadza słowo do rdzenia, żeby "składki", "składkę", "składką" były jednym tokenem.
 * @param {string} word  słowo małymi literami, np. "składkę"
 * @returns {string}
 */
export function stem(word) {
  const N = 5;
  word = word.slice(0, N);
  return word;
}

export function tokenize(text) {
  // Bez ogonków (ą→a, ę→e, ó→o): "misją" i "misja" dają ten sam rdzeń. "ł" zostaje, ale jest tak samo w pytaniu i w tekście.
  return (text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? []).map(stem);
}

/** @param {{ text: string }[]} docs */
export function buildIndex(docs) {
  const tokens = docs.map((d) => tokenize(d.text));
  const df = new Map(); // w ilu fragmentach występuje słowo
  const tf = tokens.map((list) => {
    const counts = new Map(); // ile razy słowo występuje w tym fragmencie
    for (const w of list) counts.set(w, (counts.get(w) ?? 0) + 1);
    for (const w of counts.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    return counts;
  });
  const len = tokens.map((list) => list.length);
  const avgLen = len.reduce((a, b) => a + b, 0) / docs.length;
  return { docs, tf, df, len, avgLen };
}

/** @returns {{ doc: object, score: number }[]}  najlepsze k fragmentów, od najlepszego */
export function search({ docs, tf, df, len, avgLen }, query, k = 5) {
  const terms = [...new Set(tokenize(query))];
  return docs
    .map((doc, i) => {
      let score = 0;
      for (const w of terms) {
        const f = tf[i].get(w);
        if (!f) continue;
        const idf = Math.log(1 + (docs.length - df.get(w) + 0.5) / (df.get(w) + 0.5)); // rzadkie słowa ważą więcej
        score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * len[i]) / avgLen));
      }
      return { doc, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
