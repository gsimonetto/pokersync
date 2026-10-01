"use client";

import { CheckCircle2, ChevronRight, Clock, Coins, Medal, PlayCircle, Spade, Trash2, Trophy } from "lucide-react";
import { fmtMoneyIn, fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { isSpinAndGo, type HandSessionWithCount } from "@/lib/services/hand-session-service";

// Lista de torneios do Revisor (pedido explícito: "mude a visualização do
// revisor de torneios, aquilo está bem ruim"). Antes era uma linha larga
// por torneio, com quase nada além do nome; agora cada torneio é um card
// com o que ajuda a escolher o que rever: colocação, resultado em dinheiro
// (prêmio + bounties − buy-ins), horário e o quanto da revisão já foi
// feito. Cards agrupados por dia, em grade.

export interface ProgressoTorneio {
  vistas: number;
  total: number;
  concluidas: number;
  /** Primeira e última mão jogada ("AAAA/MM/DD HH:MM"), quando o hand history diz. */
  inicio: string | null;
  fim: string | null;
}

export interface ColocacaoTorneio {
  lugar: number | null;
  inscritos: number | null;
  premio: number | null;
}

export type EstadoRevisao = "novo" | "andamento" | "revisado";

export function estadoDaRevisao(p: ProgressoTorneio | undefined, handCount: number): EstadoRevisao {
  const total = p?.total ?? handCount;
  const vistas = p?.vistas ?? 0;
  if (total > 0 && vistas >= total) return "revisado";
  return vistas > 0 ? "andamento" : "novo";
}

const ESTADO: Record<EstadoRevisao, { rotulo: string; cor: string; Icone: typeof Clock; acao: string }> = {
  novo: { rotulo: "Não começou", cor: "#E0B24C", Icone: Clock, acao: "Começar revisão" },
  andamento: { rotulo: "Em andamento", cor: "#60A5FA", Icone: PlayCircle, acao: "Continuar revisão" },
  revisado: { rotulo: "Revisado", cor: "#34D399", Icone: CheckCircle2, acao: "Rever" },
};

const VERDE = "#34D399";
const VERMELHO = "#F87171";

/** "2026/10/01 11:35:24 BRT [...]" -> Date local (sem fuso: é a hora do relógio da sala). */
function lerDataMao(s: string | null): Date | null {
  const m = s?.match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function duracao(a: Date, b: Date): string | null {
  const min = Math.round((b.getTime() - a.getTime()) / 60000);
  if (min <= 0) return null;
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

/** Dia em que o torneio foi jogado (primeira mão; sem ela, a última atualização). */
export function diaDoTorneio(s: HandSessionWithCount, p: ProgressoTorneio | undefined): Date {
  return lerDataMao(p?.inicio ?? null) ?? new Date(s.updated_at);
}

/** "Hoje", "Ontem" ou "qua., 01 de out." */
export function rotuloDoDia(d: Date): string {
  const hoje = new Date();
  const zero = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((zero(hoje) - zero(d)) / 86400000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

/** Resultado do torneio em US$: prêmio + bounties − (buy-in × entradas).
 *  null quando o buy-in não é conhecido (torneio colado à mão, cash). */
export function resultadoDoTorneio(s: HandSessionWithCount, c: ColocacaoTorneio | undefined, bounties: number): number | null {
  if (s.kind !== "tournament" || s.buyin == null) return null;
  const custo = Number(s.buyin) * (1 + (Number(s.reentries) || 0));
  return (c?.premio ?? 0) + bounties - custo;
}

function formatoDoTorneio(s: HandSessionWithCount): string | null {
  if (isSpinAndGo(s)) return "Spin & Go";
  if (s.kind !== "tournament") return "Cash";
  if (s.format_type === "pko") return "PKO";
  if (s.format_type === "mystery") return "Mystery";
  return s.format_type ? "Regular" : null;
}

/** "PokerStars / $27" -> sala "PokerStars", nome "$27". */
function partesDoNome(label: string): { sala: string | null; nome: string } {
  const i = label.indexOf(" / ");
  return i > 0 ? { sala: label.slice(0, i), nome: label.slice(i + 3) } : { sala: null, nome: label };
}

/** Ícone da sala no card (pedido explícito: "quero que traga o ícone do
 *  PokerStars" no lugar da bandeira). PokerStars: espada branca com a
 *  estrela vermelha no fundo vermelho; outra sala: a sigla dela; sem sala
 *  (mão colada sem cabeçalho): uma espada. Cash usa as fichas. */
function IconeDaSala({ sala, cash }: { sala: string | null; cash: boolean }) {
  const nome = (sala ?? "").toLowerCase().replace(/\s+/g, "");
  if (nome.includes("pokerstars"))
    return (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" style={{ background: "linear-gradient(180deg,#d4262c,#a3141a)" }} title="PokerStars">
        <svg width="32" height="32" viewBox="4 2.5 16 18.5" aria-hidden>
          <path d="M12 3C12 3 5 9 5 13.2c0 2.4 1.9 4.1 4 4.1 1.1 0 2-.5 2.6-1.2l-1 4.4h2.8l-1-4.4c.6.7 1.5 1.2 2.6 1.2 2.1 0 4-1.7 4-4.1C19 9 12 3 12 3z" fill="#fff" />
          <polygon points="12.00,9.50 12.71,11.43 14.76,11.50 13.14,12.77 13.70,14.75 12.00,13.60 10.30,14.75 10.86,12.77 9.24,11.50 11.29,11.43" fill="#c8161d" />
        </svg>
      </span>
    );
  const sigla = nome.includes("gg") ? "GG" : nome.includes("888") ? "888" : nome.includes("party") ? "PP" : nome.includes("winamax") ? "WA" : null;
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]" title={sala ?? undefined}>
      {cash ? (
        <Coins size={17} className="text-evolution" />
      ) : sigla ? (
        <span className="text-[12px] font-black tracking-tight text-ink">{sigla}</span>
      ) : (
        <Spade size={17} className="text-review" fill="currentColor" />
      )}
    </span>
  );
}

function Colocacao({ s, c }: { s: HandSessionWithCount; c: ColocacaoTorneio | undefined }) {
  if (s.champion)
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-evolution">
        <Trophy size={13} /> Campeão
      </span>
    );
  if (s.final_place === 2 || s.final_place === 3)
    return (
      <span className="inline-flex items-center gap-1 font-semibold" style={{ color: s.final_place === 2 ? "#C0C6CC" : "#CD7F32" }}>
        <Medal size={13} /> {s.final_place}º lugar
      </span>
    );
  if (c?.lugar)
    return (
      <span className="text-ink/90">
        <b className="tnum font-semibold text-ink">{c.lugar}º</b>
        {c.inscritos ? <span className="text-muted"> de {c.inscritos.toLocaleString("pt-BR")}</span> : null}
        {s.reached_ft && <span className="ml-1.5 rounded bg-white/10 px-1 py-px text-[9.5px] font-bold text-ink">FT</span>}
      </span>
    );
  if (s.reached_ft) return <span className="font-semibold text-ink">Mesa final</span>;
  return <span className="text-muted">—</span>;
}

/** Anel de progresso: mãos vistas na mesa / total. */
function Anel({ pct, cor }: { pct: number; cor: string }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
    </svg>
  );
}

export function CardTorneio({
  s,
  progresso,
  colocacao,
  bounties,
  onAbrir,
  onExcluir,
  indice = 0,
  maosNoFiltro,
}: {
  s: HandSessionWithCount;
  progresso: ProgressoTorneio | undefined;
  colocacao: ColocacaoTorneio | undefined;
  /** Bounties ganhos nas mãos (US$). */
  bounties: number;
  onAbrir: () => void;
  /** Exclui este torneio (com as mãos dele) -- pede confirmação antes. */
  onExcluir?: () => void;
  indice?: number;
  /** Com filtro de mãos ativo: quantas mãos deste torneio batem. */
  maosNoFiltro?: number;
}) {
  const { sala, nome } = partesDoNome(s.label);
  const formato = formatoDoTorneio(s);
  const total = progresso?.total ?? Number(s.hand_count || 0);
  const vistas = progresso?.vistas ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((vistas / total) * 100)) : 0;
  const estado = estadoDaRevisao(progresso, Number(s.hand_count || 0));
  const meta = ESTADO[estado];

  const inicio = lerDataMao(progresso?.inicio ?? null);
  const fim = lerDataMao(progresso?.fim ?? null);
  const tempo = inicio && fim ? duracao(inicio, fim) : null;

  // Resultado do torneio: prêmio + bounties − (buy-in × entradas). Só
  // quando o buy-in é conhecido (torneio importado pelo Radar).
  const rebuys = Number(s.reentries) || 0;
  const custo = s.kind === "tournament" && s.buyin != null ? Number(s.buyin) * (1 + rebuys) : null;
  const resultado = resultadoDoTorneio(s, colocacao, bounties);

  return (
    <li style={{ animationDelay: `${Math.min(indice, 10) * 30}ms` }} className="fade-in-up">
      {/* div com papel de botão (e não <button>): dentro dele fica o botão
          de excluir, e botão dentro de botão não é permitido. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onAbrir}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onAbrir();
          }
        }}
        className="painel-vidro group flex h-full w-full cursor-pointer flex-col gap-3 rounded-2xl border border-white/10 p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E0B24C]"
      >
        {/* Cabeçalho: sala, nome (buy-in), formato e estado da revisão. */}
        <div className="flex items-start gap-3">
          <IconeDaSala sala={sala} cash={s.kind !== "tournament"} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{sala ?? (s.kind === "tournament" ? "Torneio" : "Cash")}</span>
            <span className="flex items-center gap-2">
              <span className="truncate text-[17px] font-bold leading-tight text-ink">{nome}</span>
              {formato && (
                <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-ink/80">
                  {formato}
                </span>
              )}
            </span>
          </span>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
            style={{ color: meta.cor, background: `${meta.cor}1A`, border: `1px solid ${meta.cor}40` }}
          >
            <meta.Icone size={11} /> {meta.rotulo}
          </span>
        </div>

        {/* Números do torneio: colocação, resultado e horário. */}
        <dl className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-[12px]">
          <div className="min-w-0">
            <dt className="text-[10.5px] text-muted">Colocação</dt>
            <dd className="mt-0.5 truncate">
              <Colocacao s={s} c={colocacao} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10.5px] text-muted">Resultado</dt>
            <dd className="tnum mt-0.5 truncate font-semibold" style={{ color: resultado == null ? undefined : resultado >= 0 ? VERDE : VERMELHO }}>
              {resultado == null ? <span className="text-muted">—</span> : fmtSignedMoneyIn(resultado, "USD")}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10.5px] text-muted">Horário</dt>
            <dd className="tnum mt-0.5 truncate text-ink/90">
              {inicio ? (
                <>
                  {hora(inicio)}
                  {fim && fim.getTime() !== inicio.getTime() ? `–${hora(fim)}` : ""}
                </>
              ) : (
                <span className="text-muted">—</span>
              )}
            </dd>
          </div>
        </dl>

        {/* Detalhes do custo: o que entrou na conta do resultado. */}
        <p className="-mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted">
          {custo != null && <span>Investido {fmtMoneyIn(custo, "USD")}</span>}
          {rebuys > 0 && (
            <span title="Detectado sozinho: você perdeu todas as fichas e voltou ao mesmo torneio" className="font-semibold text-[#f59e0b]">
              · {rebuys} rebuy{rebuys === 1 ? "" : "s"}
            </span>
          )}
          {bounties > 0 && <span className="font-semibold text-[#FBBF24]">· +{fmtMoneyIn(bounties, "USD")} em bounties</span>}
          {tempo && <span>· {tempo} de jogo</span>}
          {(s.format_type === "pko" || s.format_type === "mystery") && s.bounty_current != null && (
            <span>· bounty na sua cabeça {fmtMoneyIn(Number(s.bounty_current), "USD")}</span>
          )}
          <span>
            · {s.hand_count} mão{Number(s.hand_count) === 1 ? "" : "s"}
          </span>
        </p>

        {/* Progresso da revisão + ação. */}
        <div className="mt-auto flex items-center gap-3 border-t border-white/[0.06] pt-3">
          <span className="relative grid place-items-center">
            <Anel pct={pct} cor={meta.cor} />
            <span className="tnum absolute text-[10px] font-bold text-ink">{pct}%</span>
          </span>
          <span className="min-w-0 flex-1 text-[12px] leading-snug text-muted">
            {maosNoFiltro != null && (
              <span className="mb-0.5 block font-semibold text-review">
                {maosNoFiltro} {maosNoFiltro === 1 ? "mão bate" : "mãos batem"} com o filtro
              </span>
            )}
            <b className="tnum font-semibold text-ink">{vistas}</b> de {total} mãos vistas
            {progresso && progresso.concluidas > 0 && (
              <>
                <br />
                {progresso.concluidas} com análise
              </>
            )}
          </span>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors"
            style={
              estado === "revisado"
                ? { color: VERDE, borderColor: `${VERDE}40`, background: `${VERDE}14` }
                : { color: "#111", borderColor: "transparent", background: "#E0B24C" }
            }
          >
            {meta.acao} <ChevronRight size={14} />
          </span>
          {onExcluir && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExcluir();
              }}
              aria-label={`Excluir o torneio ${s.label}`}
              title="Excluir este torneio"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-muted transition-colors hover:border-[#F87171]/50 hover:bg-[#F87171]/10 hover:text-[#F87171]"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
