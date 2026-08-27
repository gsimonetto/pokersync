"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  MessageCircleWarning,
  Sparkles,
  X,
} from "lucide-react";
import {
  fetchFunnelPhases,
  fetchPlayerCards,
  movePlayerCard,
  progressoPronto,
  traduzErroFunil,
  type FunnelPhase,
  type PlayerCard,
} from "@/lib/services/team-funnel-service";
import {
  fetchTeamAlerts,
  ALERTA_LABEL,
  type TeamAlert,
  type TeamAlertKind,
  type TeamDashboardRow,
} from "@/lib/services/team-service";

// Resumo do coach: o que precisa de decisao agora, morando na aba
// Jogadores (nao no Funil — o coach passa mais tempo aqui, e o board do
// Kanban ja tem espaco curto o suficiente sem competir com isso).
// "lembrete_estudo" fica de fora: e' so' o registro de que o sistema
// mandou um lembrete automatico pro jogador, nao pede nenhuma decisao
// do coach — mostrar isso aqui so' seria ruido.
const ALERTA_IRRELEVANTE: Set<TeamAlertKind> = new Set(["lembrete_estudo"]);

const ALERTA_ICON: Record<string, typeof AlertTriangle> = {
  faltas_consecutivas: CalendarCheck,
  rsvp_sem_resposta: MessageCircleWarning,
  inatividade: Clock,
  queda_frequencia: AlertTriangle,
  sem_revisao: AlertTriangle,
  mao_sem_resposta: MessageCircleWarning,
};

// Memoria de "ja vi isso" do Assistente — guardada no navegador (nao no
// banco: e' so' preferencia de leitura, nao precisa sincronizar entre
// dispositivos). Cada item some assim que o coach clica nele (via
// dismiss()) ou sozinho depois de 24h do primeiro aparecimento, o que
// vier primeiro — libera espaco pros proximos itens da fila em vez de
// empilhar aviso velho pra sempre.
const ASSISTENTE_MEMORIA_KEY = "ps_funil_assistente_memoria";
const ASSISTENTE_EXPIRA_MS = 24 * 60 * 60 * 1000;

function useAssistenteMemoria() {
  const [memoria, setMemoria] = useState<Record<string, { primeiraVezEm: number; dispensadoEm?: number }>>({});

  useEffect(() => {
    try {
      setMemoria(JSON.parse(localStorage.getItem(ASSISTENTE_MEMORIA_KEY) ?? "{}"));
    } catch {
      setMemoria({});
    }
  }, []);

  function persistir(next: typeof memoria) {
    setMemoria(next);
    try {
      localStorage.setItem(ASSISTENTE_MEMORIA_KEY, JSON.stringify(next));
    } catch {
      // localStorage indisponivel (modo privado etc.) — degrada pra "sempre visivel", sem quebrar a tela.
    }
  }

  function registrarVistas(chaves: string[]) {
    let mudou = false;
    const next = { ...memoria };
    for (const k of chaves) {
      if (!next[k]) {
        next[k] = { primeiraVezEm: Date.now() };
        mudou = true;
      }
    }
    if (mudou) persistir(next);
  }

  function dispensar(chave: string) {
    persistir({ ...memoria, [chave]: { primeiraVezEm: memoria[chave]?.primeiraVezEm ?? Date.now(), dispensadoEm: Date.now() } });
  }

  function visivel(chave: string): boolean {
    const m = memoria[chave];
    if (!m) return true;
    if (m.dispensadoEm) return false;
    return Date.now() - m.primeiraVezEm < ASSISTENTE_EXPIRA_MS;
  }

  return { registrarVistas, dispensar, visivel };
}

export function AssistenteCoach({
  teamId,
  jogadores,
  onErro,
  onAbrirFicha,
}: {
  teamId: string;
  jogadores: TeamDashboardRow[];
  onErro: (s: string) => void;
  /** Quando informado (ex: aba Jogadores), abre a ficha em modal em vez de navegar pra fora da tela. */
  onAbrirFicha?: (playerId: string) => void;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [fases, setFases] = useState<FunnelPhase[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [alertas, setAlertas] = useState<TeamAlert[]>([]);
  const [carregado, setCarregado] = useState(false);
  const { registrarVistas, dispensar, visivel } = useAssistenteMemoria();

  const porNome = useMemo(() => {
    const m = new Map<string, TeamDashboardRow>();
    jogadores.forEach((j) => m.set(j.userId, j));
    return m;
  }, [jogadores]);

  async function carregar() {
    try {
      const [f, c, al] = await Promise.all([
        fetchFunnelPhases(teamId),
        fetchPlayerCards(),
        fetchTeamAlerts(14).catch(() => []),
      ]);
      setFases(f);
      setCards(c);
      setAlertas(al);
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setCarregado(true);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const prontos = useMemo(() => cards.filter(progressoPronto), [cards]);
  const estagnados = useMemo(() => {
    const limite = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return cards.filter((c) => !progressoPronto(c) && new Date(c.movedAt).getTime() < limite && c.drillsDone === 0 && c.reviewsDone === 0);
  }, [cards]);
  const comFaltas = useMemo(() => cards.filter((c) => c.eventosAusente >= 2), [cards]);
  const alertasRelevantes = useMemo(() => alertas.filter((a) => !ALERTA_IRRELEVANTE.has(a.kind)), [alertas]);

  useEffect(() => {
    registrarVistas([
      ...prontos.map((c) => `pronto:${c.cardId}`),
      ...comFaltas.map((c) => `falta:${c.cardId}`),
      ...estagnados.map((c) => `estagnado:${c.cardId}`),
      ...alertasRelevantes.map((a) => `alerta:${a.id}`),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prontos, comFaltas, estagnados, alertasRelevantes]);

  async function moverProximaFase(card: PlayerCard) {
    const idx = fases.findIndex((f) => f.id === card.phaseId);
    const proxima = fases[idx + 1];
    if (!proxima) return;
    try {
      await movePlayerCard(card.playerId, proxima.id);
      await carregar();
    } catch (e) {
      onErro(traduzErroFunil(e));
    }
  }

  const prontosVisiveis = prontos.filter((c) => visivel(`pronto:${c.cardId}`));
  const comFaltasVisiveis = comFaltas.filter((c) => visivel(`falta:${c.cardId}`));
  const estagnadosVisiveis = estagnados.filter((c) => visivel(`estagnado:${c.cardId}`));
  const alertasVisiveis = alertasRelevantes.filter((a) => visivel(`alerta:${a.id}`)).slice(0, 6);

  const total = prontosVisiveis.length + estagnadosVisiveis.length + comFaltasVisiveis.length + alertasVisiveis.length;
  if (!carregado || total === 0) return null;

  function abrirFicha(playerId: string) {
    if (onAbrirFicha) onAbrirFicha(playerId);
    else router.push(`/time/jogador/${playerId}`);
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-[15px] font-semibold"
      >
        <Sparkles size={16} />
        Assistente do coach
        <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-bold text-muted">{total}</span>
        <ChevronDown size={16} className={`ml-auto text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {prontosVisiveis.length > 0 && (
          <div className="rounded-lg border border-positive/30 bg-positive/5 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-positive">
              <CheckCircle2 size={13} /> Prontos pra subir de fase
            </p>
            <ul className="mt-2 space-y-1.5">
              {prontosVisiveis.map((c) => {
                const j = porNome.get(c.playerId);
                return (
                  <li key={c.cardId} className="flex items-center justify-between gap-2 text-[13px]">
                    <button onClick={() => { dispensar(`pronto:${c.cardId}`); abrirFicha(c.playerId); }} className="min-w-0 truncate text-left hover:underline">{j?.nome ?? "Jogador"}</button>
                    <button onClick={() => { dispensar(`pronto:${c.cardId}`); moverProximaFase(c); }}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-positive/40 px-2 py-0.5 text-[11px] text-positive transition-colors hover:bg-positive/10">
                      Subir fase <ArrowRight size={11} />
                    </button>
                    <button onClick={() => dispensar(`pronto:${c.cardId}`)} aria-label="Dispensar" className="shrink-0 text-muted/60 hover:text-muted">
                      <X size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {comFaltasVisiveis.length > 0 && (
          <div className="rounded-lg border border-negative/30 bg-negative/5 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-negative">
              <AlertTriangle size={13} /> Faltando às reuniões
            </p>
            <ul className="mt-2 space-y-1.5">
              {comFaltasVisiveis.map((c) => {
                const j = porNome.get(c.playerId);
                return (
                  <li key={c.cardId} className="flex items-center justify-between gap-2">
                    <button onClick={() => { dispensar(`falta:${c.cardId}`); abrirFicha(c.playerId); }} className="min-w-0 truncate text-left text-[13px] hover:underline">
                      {j?.nome ?? "Jogador"} <span className="text-muted">· {c.eventosAusente} faltas</span>
                    </button>
                    <button onClick={() => dispensar(`falta:${c.cardId}`)} aria-label="Dispensar" className="shrink-0 text-muted/60 hover:text-muted">
                      <X size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {estagnadosVisiveis.length > 0 && (
          <div className="rounded-lg border border-evolution/30 bg-evolution/5 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-evolution">
              <Clock size={13} /> Sem progresso há 14+ dias na fase
            </p>
            <ul className="mt-2 space-y-1.5">
              {estagnadosVisiveis.map((c) => {
                const j = porNome.get(c.playerId);
                return (
                  <li key={c.cardId} className="flex items-center justify-between gap-2">
                    <button onClick={() => { dispensar(`estagnado:${c.cardId}`); abrirFicha(c.playerId); }} className="min-w-0 truncate text-left text-[13px] hover:underline">{j?.nome ?? "Jogador"}</button>
                    <button onClick={() => dispensar(`estagnado:${c.cardId}`)} aria-label="Dispensar" className="shrink-0 text-muted/60 hover:text-muted">
                      <X size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {alertasVisiveis.length > 0 && (
          <div className="rounded-lg border border-hairline bg-elevated p-3">
            <p className="text-[12px] font-semibold text-muted">Últimos alertas do sistema</p>
            <ul className="mt-2 space-y-1.5">
              {alertasVisiveis.map((a) => {
                const j = porNome.get(a.playerId);
                const Icon = ALERTA_ICON[a.kind] ?? AlertTriangle;
                return (
                  <li key={a.id} className="flex items-start justify-between gap-1.5">
                    <button onClick={() => { dispensar(`alerta:${a.id}`); abrirFicha(a.playerId); }} className="flex min-w-0 items-start gap-1.5 text-left text-[12px] text-muted hover:underline">
                      <Icon size={12} className="mt-0.5 shrink-0" />
                      <span><strong className="text-ink/80">{j?.nome ?? "Jogador"}</strong> · {ALERTA_LABEL[a.kind]}</span>
                    </button>
                    <button onClick={() => dispensar(`alerta:${a.id}`)} aria-label="Dispensar" className="shrink-0 text-muted/60 hover:text-muted">
                      <X size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      )}
    </section>
  );
}
