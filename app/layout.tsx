import './globals.css';
import { Roboto_Slab } from 'next/font/google';

// Pobierana przy buildzie, więc w repo nie ma plików czcionek. Licencja OFL pozwala na wszystko.
const font = Roboto_Slab({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '500', '700'],
  variable: '--font-main',
  display: 'swap',
});

export const metadata = { title: 'Harcerski czat', description: 'Odpowiedzi na podstawie publicznych dokumentów ZHP, z cytatami.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
