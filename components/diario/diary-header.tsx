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

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

// Bolinha por dia dos últimos 7 -- não é o mesmo dado que streakDays
// (contagem corrida): aqui dá pra ver EM QUAL dia especificamente o
// jogador não apareceu, reforçando a ideia de hábito/diário em vez de
// só um número.
function StreakTracker({ last7Days }: { last7Days: boolean[] }) {
  const hoje = new Date();
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-label="Atividade dos últimos 7 dias">
      {last7Days.map((ativo, i) => {
        const d = new Date(hoje);
        d.setDate(d.getDate() - (last7Days.length - 1 - i));
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className={`size-2.5 rounded-full ${ativo ? "bg-positive" : "bg-hairline"}`}
              title={d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
            />
            <span className="text-[9px] font-medium text-muted/70">{DIAS_SEMANA[d.getDay()]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DiaryHeader({
  nome,
  streakDays,
  last7Days,
}: {
  nome: string;
  streakDays: number | null;
  last7Days?: boolean[] | null;
}) {
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
      {last7Days && last7Days.length === 7 && <StreakTracker last7Days={last7Days} />}
    </header>
  );
}
