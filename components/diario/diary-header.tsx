"use client";

// Cabeçalho editorial do Diário — data de hoje, saudação por horário e a
// linha de sequência (streak), mesma fonte de dados do FlameStat do Hub
// (progress.streak_days, ver lib/services/xp-service.ts).

function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] || nomeCompleto;
}

function dataDeHoje(): string {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return hoje.charAt(0).toUpperCase() + hoje.slice(1);
}

export function DiaryHeader({ nome, streakDays }: { nome: string; streakDays: number | null }) {
  const agora = new Date().getHours();
  const primeiro = nome ? primeiroNome(nome) : "";

  return (
    <header className="fade-in-up">
      {/* Animação contínua do 🔥 (só nos indicadores de "indo bem",
          nunca em itens de agenda) — tremular sutil, pausado com
          prefers-reduced-motion. Escopado neste arquivo, mesmo padrão
          já usado em outras telas (ver .hub-flame-icon no Hub). */}
      <style>{`
        @keyframes diarioFlameFlicker {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25%      { transform: scale(1.08) rotate(-4deg); }
          50%      { transform: scale(0.96) rotate(2deg); }
          75%      { transform: scale(1.06) rotate(4deg); }
        }
        .diario-flame { display: inline-block; animation: diarioFlameFlicker 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .diario-flame { animation: none; }
        }
      `}</style>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{dataDeHoje()}</p>
      <h1 className="mt-1.5 text-2xl font-bold text-ink sm:text-3xl">
        {saudacao(agora)}{primeiro ? `, ${primeiro}` : ""}.
      </h1>
      {streakDays !== null && (
        <p className="mt-2 text-sm text-muted">
          {streakDays > 0 && <span className="diario-flame mr-1">🔥</span>}
          Sequência de {streakDays} {streakDays === 1 ? "dia" : "dias"} escrevendo seu diário
        </p>
      )}
    </header>
  );
}
