// Nagłówki bezpieczeństwa: strona nie da się osadzić w ramce na cudzej stronie, przeglądarka nie zgaduje typów plików,
// a nagłówek "X-Powered-By: Next.js" nie zdradza, na czym działa aplikacja.
export default {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
