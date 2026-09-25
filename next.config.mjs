/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Construtor de Ranges refeito numa tela só (/ranges, com abas): links
  // antigos (favoritos, notificações) caem no lugar certo em vez de 404.
  async redirects() {
    return [
      { source: "/ranges/biblioteca", destination: "/ranges?aba=meus", permanent: false },
      { source: "/ranges/time", destination: "/ranges?aba=meus", permanent: false },
      { source: "/ranges/equidade", destination: "/ranges", permanent: false },
      { source: "/ranges/compare", destination: "/ranges", permanent: false },
      { source: "/ranges/journal", destination: "/ranges", permanent: false },
      { source: "/ranges/arvores/:rest*", destination: "/ranges", permanent: false },
      { source: "/ranges/novo", destination: "/ranges", permanent: false },
      { source: "/ranges/:id", destination: "/ranges?range=:id", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Defesa extra contra XSS: mesmo sem nenhuma brecha conhecida hoje,
          // restringe de onde o navegador pode carregar/conectar recursos.
          // 'unsafe-inline' em script/style fica por ora (Next injeta script
          // inline de hydration; apertar isso pra nonce exige mudar o
          // middleware) -- ainda assim bloqueia framing, exfiltração via
          // <object>/<embed> e conexão a domínios não previstos.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self' data:",
              // economia.awesomeapi.com.br: cotação do dólar (lib/services/fx-service.ts)
              // -- sem ela aqui o navegador bloqueava a consulta, e a banca
              // em dólar nunca era convertida pra reais.
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://economia.awesomeapi.com.br",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
