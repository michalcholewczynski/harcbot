'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useState } from 'react';

// Wysyłamy tylko nowe pytanie: historię serwer bierze z Redis. Poza komponentem, żeby nie tworzyć go przy każdym renderze.
const transport = new DefaultChatTransport({ prepareSendMessagesRequest: ({ messages }) => ({ body: { message: messages.at(-1) } }) });

type Source = { url: string; title?: string };

// Zamienia "[2]" albo "[1, 3]" w tekście na linki do źródeł; numery pochodzą z serwera, nie z wyobraźni modelu.
function withCitations(text: string, sources: Source[]) {
  return text.split(/(\[\d+(?:,\s*\d+)*\])/).map((piece, i) => {
    if (!/^\[[\d,\s]+\]$/.test(piece)) return piece;
    const nums = piece.slice(1, -1).split(',').map((n) => Number(n.trim()));
    return (
      <span key={i}>
        [
        {nums.map((n, j) => (
          <span key={j}>
            {j > 0 && ', '}
            {sources[n - 1] ? (
              <a href={sources[n - 1].url} target="_blank" title={sources[n - 1].title}>
                {n}
              </a>
            ) : (
              n
            )}
          </span>
        ))}
        ]
      </span>
    );
  });
}

export default function Chat({ initialMessages, notFound }: { initialMessages: UIMessage[]; notFound: string }) {
  const { messages, setMessages, sendMessage, status, error } = useChat({ messages: initialMessages, transport });
  const [input, setInput] = useState('');
  const busy = status === 'submitted' || status === 'streaming';

  async function clearHistory() {
    const res = await fetch('/api/chat', { method: 'DELETE' });
    if (res.ok) setMessages([]);
    else alert(await res.text()); // nie udajemy, że rozmowa zniknęła, skoro po odświeżeniu by wróciła
  }

  return (
    <main>
      <h1>Harcerski czat</h1>
      <p>Odpowiadam tylko na podstawie publicznych dokumentów ZHP: Statutu, Polityki Safe from Harm, Podstaw Wychowawczych i instrukcji TiPi. Projekt niezależny, niezwiązany ze Związkiem Harcerstwa Polskiego.</p>
      <p className="privacy">
        Rozmowa jest zapisywana na serwerze przez 7 dni, żeby czat pamiętał ją przy następnej wizycie. Pytania trafiają do Google Gemini (darmowy
        plan), który może ich używać do ulepszania swoich usług, więc nie wpisuj danych osobowych.{' '}
        {messages.length > 0 && (
          <button type="button" className="link" onClick={clearHistory} disabled={busy}>
            Wyczyść historię
          </button>
        )}
      </p>

      {messages.map((m, i) => {
        const text = m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
        // Przy "Nie znalazłem…" źródła tylko by myliły: model ich nie użył.
        const sources = text.includes(notFound) ? [] : m.parts.filter((p) => p.type === 'source-url');
        return (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.role === 'user' ? text : withCitations(text, sources)}
            {status === 'streaming' && i === messages.length - 1 && m.role === 'assistant' && <span className="cursor" aria-hidden="true" />}
            {sources.length > 0 && (
              <ol className="sources">
                {sources.map((s) => (
                  <li key={s.sourceId}>
                    <a href={s.url} target="_blank">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}

      {status === 'submitted' && (
        <p className="thinking" role="status">
          Szukam w dokumentach
          <span aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
      )}
      {error && <p className="error">{error.message}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput('');
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Zadaj pytanie, np. Jaka jest misja ZHP?" aria-label="Pytanie" />
        <button type="submit" disabled={busy}>
          Wyślij
        </button>
      </form>
    </main>
  );
}
