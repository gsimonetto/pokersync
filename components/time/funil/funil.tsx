"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlarmClock,
  ArchiveRestore,
  ArrowUpRight,
  BarChart3,
  Columns3,
  ListChecks,
  Rows3,
  Search,
  Settings,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Table2,
  UserPlus,
  X,
} from "lucide-react";
import { FilterPopover } from "@/components/ui/filter-popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePainelVidro } from "@/components/dashboard/kit";
import { useConfirm } from "@/components/confirm-dialog";
import { FunilQuadro } from "@/components/time/funil/funil-quadro";
import { FunilPlanilha } from "@/components/time/funil/funil-planilha";
import { FunilRelatorios } from "@/components/time/funil/funil-relatorios";
import { FunilModalCard } from "@/components/time/funil/funil-modal-card";
import { ListaArquivados, ModalAdicionar, ModalConfigFunil } from "@/components/time/funil/funil-config";
import type { Agrupamento, Foco, ItemFunil } from "@/components/time/funil/tipos";
import {
  fetchArchivedCards,
  fetchCardLabelsForCards,
  fetchChecklistProgressForCards,
  fetchFunilSlaPadrao,
  fetchFunnelPhases,
  fetchPlayerCards,
  funilCrmDisponivel,
  movePlayerCard,
  seedDefaultPhases,
  traduzErroFunil,
  PRIORIDADE_LABEL,
  SLA_PADRAO_DIAS,
  type ArchivedCard,
  type CardLabel,
  type FunnelPhase,
  type PlayerCard,
  type Prioridade,
} from "@/lib/services/team-funnel-service";
import { calcularScore, fetchTeamLabels, type TeamDashboardRow, type TeamLabel } from "@/lib/services/team-service";
import { diasNaFase, estadoPasso, prontidao, requisitosDoCard, temperatura } from "@/lib/time/funil-regras";

// ============================================================
// Funil do time -- o CRM do modo Time.
//
// Quatro jeitos de olhar o mesmo funil:
//   Quadro     -- colunas por fase, arrastar pra mover, raias opcionais
//   Planilha   -- tabela densa, ordenável, pra comparar muitos de uma vez
//   Relatórios -- quem está pronto/esfriando, fluxo e tempo por fase
//   Arquivados -- quem saiu do funil, com restauração
//
// A barra de atenção logo abaixo das abas transforma o quadro numa fila
// de trabalho: cada contador é um filtro de um clique ("prontos pra
// subir", "esfriando", "sem próximo passo"...). Sempre ícone + texto,
// nunca só cor.
//
// Toda regra (prontidão, temperatura, próximo passo) mora em
// lib/time/funil-regras.ts; aqui só junta dados, filtra e move.
// ============================================================

type Modo = "quadro" | "planilha" | "relatorios" | "arquivados";

const FOCOS: { chave: Foco; rotulo: (n: number) => string; icone: typeof AlertCircle; cor: string; precisaCrm?: boolean }[] = [
  { chave: "prontos", rotulo: (n) => `${n} pronto${n === 1 ? "" : "s"} pra subir`, icone: ArrowUpRight, cor: "#22c55e" },
  { chave: "esfriando", rotulo: (n) => `${n} esfriando`, icone: Snowflake, cor: "#f59e0b" },
  { chave: "sem_passo", rotulo: (n) => `${n} sem próximo passo`, icone: AlertCircle, cor: "#e0555a", precisaCrm: true },
  { chave: "atrasados", rotulo: (n) => `${n} passo${n === 1 ? "" : "s"} atrasado${n === 1 ? "" : "s"}`, icone: AlarmClock, cor: "#e0555a", precisaCrm: true },
  { chave: "pendentes", rotulo: (n) => `${n} com tarefa aberta`, icone: ListChecks, cor: "#c4c7c8" },
];

function casaFoco(i: ItemFunil, foco: Foco): boolean {
  switch (foco) {
    case "prontos": return i.prontidao.pronto;
    case "esfriando": return i.temperatura !== "em_dia";
    case "sem_passo": return i.passo === "sem";
    case "atrasados": return i.passo === "atrasado";
    case "pendentes": return !!i.checklist && i.checklist.total > i.checklist.done;
  }
}

const SELECT = "w-full rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[12px] text-ink outline-none";
const ROTULO = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted/70";
const BOTAO_ICONE =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink";

export function Funil({
  teamId,
  jogadores,
  coaches,
  isAdmin,
  meuUserId,
  onErro,
  onAgendarConversa,
}: {
  teamId: string;
  jogadores: TeamDashboardRow[];
  coaches: { userId: string; nome: string }[];
  /** Só admin mexe em fases (mesma regra da RLS de team_funnel_phases). */
  isAdmin: boolean;
  /** Coach só gerencia metas do próprio jogador; admin, de todos. */
  meuUserId: string | null;
  onErro: (s: string) => void;
  onAgendarConversa: (playerId: string) => void;
}) {
  const vidro = usePainelVidro();
  const confirm = useConfirm();

  const [fases, setFases] = useState<FunnelPhase[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [labelsDoTime, setLabelsDoTime] = useState<TeamLabel[]>([]);
  const [labelsPorCard, setLabelsPorCard] = useState<Map<string, CardLabel[]>>(new Map());
  const [checklistPorCard, setChecklistPorCard] = useState<Map<string, { done: number; total: number }>>(new Map());
  const [crm, setCrm] = useState(true);
  const [slaPadrao, setSlaPadrao] = useState(SLA_PADRAO_DIAS);
  const [loading, setLoading] = useState(true);
  const [criandoFases, setCriandoFases] = useState(false);

  const [modo, setModo] = useState<Modo>("quadro");
  const [agrupar, setAgrupar] = useState<Agrupamento>("nenhum");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [arquivados, setArquivados] = useState<ArchivedCard[]>([]);
  const [carregandoArquivados, setCarregandoArquivados] = useState(false);

  // Filtros (todos combinam entre si). Busca, etiqueta, coach e
  // prioridade ficam atrás de um botão só; o foco é a barra de atenção.
  const [busca, setBusca] = useState("");
  const [filtroLabel, setFiltroLabel] = useState("todas");
  const [filtroCoach, setFiltroCoach] = useState("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade | "todas">("todas");
  const [foco, setFoco] = useState<Foco | null>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoading(true);
      try {
        const [f, c, tl, sla] = await Promise.all([
          fetchFunnelPhases(teamId),
          fetchPlayerCards(),
          fetchTeamLabels(teamId).catch(() => []),
          fetchFunilSlaPadrao(teamId).catch(() => SLA_PADRAO_DIAS),
        ]);
        setFases(f);
        setSlaPadrao(sla);
        setCards(c);
        setLabelsDoTime(tl);
        setCrm(funilCrmDisponivel());
        const ids = c.map((card) => card.cardId);
        const [lbl, chk] = await Promise.all([
          fetchCardLabelsForCards(ids).catch(() => new Map<string, CardLabel[]>()),
          fetchChecklistProgressForCards(ids).catch(() => new Map<string, { done: number; total: number }>()),
        ]);
        setLabelsPorCard(lbl);
        setChecklistPorCard(chk);
      } catch (e) {
        onErro(traduzErroFunil(e));
      } finally {
        setLoading(false);
      }
    },
    [teamId, onErro]
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarArquivados = useCallback(async () => {
    setCarregandoArquivados(true);
    try {
      setArquivados(await fetchArchivedCards());
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setCarregandoArquivados(false);
    }
  }, [onErro]);

  useEffect(() => {
    if (modo === "arquivados") carregarArquivados();
  }, [modo, carregarArquivados]);

  const porJogador = useMemo(() => new Map(jogadores.map((j) => [j.userId, j])), [jogadores]);
  const porFase = useMemo(() => new Map(fases.map((f) => [f.id, f])), [fases]);

  // Tudo calculado uma vez; quadro, planilha, relatórios e cartão leem daqui.
  const itens = useMemo<ItemFunil[]>(() => {
    const agora = Date.now();
    return cards.map((card) => {
      const jogador = porJogador.get(card.playerId);
      const fase = porFase.get(card.phaseId);
      const score = jogador ? calcularScore(jogador).valor : null;
      const requisitos = requisitosDoCard(card, fase, score);
      return {
        card,
        jogador,
        fase,
        nome: jogador?.nome ?? "Jogador",
        score,
        requisitos,
        prontidao: prontidao(requisitos),
        temperatura: temperatura(card, fase, agora, slaPadrao),
        diasNaFase: diasNaFase(card, agora),
        passo: crm ? estadoPasso(card, agora) : null,
        labels: labelsPorCard.get(card.cardId) ?? [],
        checklist: checklistPorCard.get(card.cardId) ?? null,
      };
    });
  }, [cards, porJogador, porFase, labelsPorCard, checklistPorCard, crm, slaPadrao]);

  const totalPorFase = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itens) m.set(i.card.phaseId, (m.get(i.card.phaseId) ?? 0) + 1);
    return m;
  }, [itens]);

  const contagemFoco = useMemo(() => {
    const m = new Map<Foco, number>();
    for (const f of FOCOS) m.set(f.chave, itens.filter((i) => casaFoco(i, f.chave)).length);
    return m;
  }, [itens]);

  const filtrosAtivos = busca.trim() !== "" || filtroLabel !== "todas" || filtroCoach !== "todos" || filtroPrioridade !== "todas";

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (foco && !casaFoco(i, foco)) return false;
      if (filtroLabel !== "todas" && !i.labels.some((l) => l.id === filtroLabel)) return false;
      if (filtroCoach !== "todos" && (i.jogador?.coachId ?? "~sem") !== filtroCoach) return false;
      if (filtroPrioridade !== "todas" && i.card.prioridade !== filtroPrioridade) return false;
      if (termo) {
        const alvo = [i.nome, i.card.notes, i.card.nextStep, i.jogador?.labelName, ...i.labels.map((l) => l.name)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [itens, foco, filtroLabel, filtroCoach, filtroPrioridade, busca]);

  const semCard = useMemo(() => {
    const comCard = new Set(cards.map((c) => c.playerId));
    return jogadores.filter((j) => !comCard.has(j.userId));
  }, [jogadores, cards]);

  // Mover: avisa (não bloqueia) quando sobe sem bater os requisitos ou
  // quando a fase de destino já está na capacidade. A decisão é do coach.
  // Devolve true se moveu (false = coach cancelou no aviso, ou erro).
  const mover = useCallback(
    async (item: ItemFunil, destino: FunnelPhase): Promise<boolean> => {
      if (destino.id === item.card.phaseId) return false;
      const avisos: string[] = [];
      const subindo = destino.sortOrder > (item.fase?.sortOrder ?? -Infinity);
      if (subindo && item.prontidao.total > 0 && !item.prontidao.pronto) {
        const faltam = item.requisitos.filter((r) => !r.ok).map((r) => r.rotulo.toLowerCase());
        avisos.push(`${item.nome} ainda não bateu ${faltam.join(", ")}.`);
      }
      const ocupacao = totalPorFase.get(destino.id) ?? 0;
      if (destino.wipLimit != null && ocupacao >= destino.wipLimit) {
        avisos.push(`${destino.name} já está com ${ocupacao} de ${destino.wipLimit} vagas.`);
      }
      if (avisos.length > 0) {
        const ok = await confirm({
          title: `Mover para ${destino.name}?`,
          message: `${avisos.join(" ")} Mover mesmo assim?`,
          confirmLabel: "Mover",
          tone: "default",
        });
        if (!ok) return false;
      }

      // Otimista: o cartão já muda de coluna; o recarregamento traz os
      // números da fase nova (drills/reviews contam a partir de agora).
      const anterior = cards;
      setCards((cs) =>
        cs.map((c) =>
          c.playerId === item.card.playerId
            ? { ...c, phaseId: destino.id, phaseName: destino.name, phaseColor: destino.color, phaseSortOrder: destino.sortOrder, movedAt: new Date().toISOString() }
            : c
        )
      );
      try {
        await movePlayerCard(item.card.playerId, destino.id);
        await carregar(true);
        return true;
      } catch (e) {
        setCards(anterior);
        onErro(traduzErroFunil(e));
        return false;
      }
    },
    [cards, totalPorFase, confirm, carregar, onErro]
  );

  const promover = useCallback(
    async (item: ItemFunil): Promise<boolean> => {
      const idx = fases.findIndex((f) => f.id === item.card.phaseId);
      const proxima = idx >= 0 ? fases[idx + 1] : undefined;
      return proxima ? mover(item, proxima) : false;
    },
    [fases, mover]
  );

  async function criarFasesPadrao() {
    setCriandoFases(true);
    try {
      await seedDefaultPhases(teamId);
      await carregar();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setCriandoFases(false);
    }
  }

  function limparFiltros() {
    setBusca("");
    setFiltroLabel("todas");
    setFiltroCoach("todos");
    setFiltroPrioridade("todas");
    setFoco(null);
  }

  const itemAberto = abertoId ? itens.find((i) => i.card.playerId === abertoId) : undefined;
  const moldura = vidro ? "painel-vidro rounded-3xl border border-white/10" : "rounded-2xl border border-hairline bg-surface";

  if (loading) return <div className="painel-esqueleto h-[480px] rounded-3xl" />;

  if (fases.length === 0) {
    return (
      <section className={`${moldura} p-8 text-center`}>
        <Sparkles size={22} className="mx-auto text-muted" />
        <h2 className="mt-2 text-base font-semibold">Nenhuma fase criada ainda</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Comece com o funil padrão (Prospecção → Base → Desenvolvimento → Elite) e ajuste depois: faixa de buy-in, capacidade e requisitos de subida de cada fase.
        </p>
        <button
          onClick={criarFasesPadrao}
          disabled={criandoFases}
          className="mt-4 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {criandoFases ? "Criando…" : "Criar fases padrão"}
        </button>
      </section>
    );
  }

  const comFiltros = modo === "quadro" || modo === "planilha";
  const focosVisiveis = FOCOS.filter((f) => (!f.precisaCrm || crm) && ((contagemFoco.get(f.chave) ?? 0) > 0 || foco === f.chave));

  return (
    <div className={`flex min-h-0 flex-1 flex-col p-4 sm:p-5 ${moldura}`}>
      {/* Barra de ferramentas */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={modo}
          onChange={setModo}
          options={[
            { value: "quadro", label: <><Columns3 size={13} /><span className="sr-only sm:not-sr-only">Quadro</span></> },
            { value: "planilha", label: <><Table2 size={13} /><span className="sr-only sm:not-sr-only">Planilha</span></> },
            { value: "relatorios", label: <><BarChart3 size={13} /><span className="sr-only sm:not-sr-only">Relatórios</span></> },
            { value: "arquivados", label: <><ArchiveRestore size={13} /><span className="sr-only sm:not-sr-only">Arquivados</span></> },
          ]}
        />

        {comFiltros && (
          <FilterPopover label="Filtros" icon={SlidersHorizontal} active={filtrosAtivos}>
            <div>
              <label className={ROTULO}>Buscar</label>
              <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2 py-1.5">
                <Search size={12} className="shrink-0 text-muted" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, passo, anotação, etiqueta…"
                  className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-muted/50"
                />
              </div>
            </div>
            {labelsDoTime.length > 0 && (
              <div>
                <label className={ROTULO}>Etiqueta do cartão</label>
                <select value={filtroLabel} onChange={(e) => setFiltroLabel(e.target.value)} className={SELECT}>
                  <option value="todas">Todas</option>
                  {labelsDoTime.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            {coaches.length > 0 && (
              <div>
                <label className={ROTULO}>Coach</label>
                <select value={filtroCoach} onChange={(e) => setFiltroCoach(e.target.value)} className={SELECT}>
                  <option value="todos">Todos</option>
                  {coaches.map((c) => <option key={c.userId} value={c.userId}>{c.nome}</option>)}
                  <option value="~sem">Sem coach</option>
                </select>
              </div>
            )}
            {crm && (
              <div>
                <label className={ROTULO}>Prioridade</label>
                <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value as Prioridade | "todas")} className={SELECT}>
                  <option value="todas">Todas</option>
                  {(["alta", "normal", "baixa"] as Prioridade[]).map((p) => <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>)}
                </select>
              </div>
            )}
            {filtrosAtivos && (
              <button type="button" onClick={limparFiltros} className="self-start text-[11px] font-semibold text-muted hover:text-ink">
                Limpar filtros
              </button>
            )}
          </FilterPopover>
        )}

        {modo === "quadro" && (
          <label className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5" title="Dividir o quadro em raias">
            <Rows3 size={13} className="text-muted" />
            <select
              value={agrupar}
              onChange={(e) => setAgrupar(e.target.value as Agrupamento)}
              aria-label="Agrupar quadro"
              className="bg-transparent text-[11.5px] font-semibold text-ink outline-none"
            >
              <option value="nenhum" className="bg-[#141414]">Sem raias</option>
              <option value="coach" className="bg-[#141414]">Raias por coach</option>
              <option value="etiqueta" className="bg-[#141414]">Raias por etiqueta</option>
              {crm && <option value="prioridade" className="bg-[#141414]">Raias por prioridade</option>}
            </select>
          </label>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setModalConfig(true)} className={BOTAO_ICONE} aria-label="Configurações do funil" title="Configurações do funil">
              <Settings size={15} />
            </button>
          )}
          <button onClick={() => setModalAdicionar(true)} className={BOTAO_ICONE} aria-label="Adicionar ao funil" title="Adicionar ao funil">
            <UserPlus size={15} />
          </button>
        </div>
      </div>

      {/* Barra de atenção: cada contador é um filtro de um clique. */}
      {comFiltros && (focosVisiveis.length > 0 || filtrosAtivos) && (
        // Celular: uma linha só, deslizando de lado (em várias linhas
        // comia metade da tela antes do quadro). sm+: quebra linha.
        <div
          className="-mx-4 mb-3 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          role="toolbar"
          aria-label="Atalhos de atenção"
        >
          {focosVisiveis.map((f) => {
            const ativo = foco === f.chave;
            const Icone = f.icone;
            return (
              <button
                key={f.chave}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFoco(ativo ? null : f.chave)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                  ativo ? "" : "border-hairline text-muted hover:border-white/20 hover:text-ink"
                }`}
                style={ativo ? { color: f.cor, borderColor: `${f.cor}66`, background: `${f.cor}14` } : undefined}
              >
                <Icone size={12} style={ativo ? undefined : { color: f.cor }} />
                {f.rotulo(contagemFoco.get(f.chave) ?? 0)}
                {ativo && <X size={11} />}
              </button>
            );
          })}
          {(foco || filtrosAtivos) && (
            <span className="ml-1 shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-muted">
              {filtrados.length} de {itens.length}
              <button type="button" onClick={limparFiltros} className="ml-2 font-semibold hover:text-ink">
                Limpar
              </button>
            </span>
          )}
        </div>
      )}

      {modo === "quadro" && (
        <FunilQuadro
          teamId={teamId}
          fases={fases}
          itens={filtrados}
          totalPorFase={totalPorFase}
          agrupar={agrupar}
          coaches={coaches}
          onAbrir={(i) => setAbertoId(i.card.playerId)}
          onMover={mover}
          onPromover={promover}
        />
      )}
      {modo === "planilha" && (
        <FunilPlanilha fases={fases} itens={filtrados} onAbrir={(i) => setAbertoId(i.card.playerId)} onMover={mover} />
      )}
      {modo === "relatorios" && (
        <FunilRelatorios fases={fases} itens={itens} semCard={semCard.length} coaches={coaches} onErro={onErro} />
      )}
      {modo === "arquivados" && (
        <ListaArquivados
          arquivados={arquivados}
          carregando={carregandoArquivados}
          fases={fases}
          onErro={onErro}
          onRestaurar={async (playerId, phaseId) => {
            await movePlayerCard(playerId, phaseId);
            await Promise.all([carregar(true), carregarArquivados()]);
          }}
        />
      )}

      {itemAberto && (
        <FunilModalCard
          key={itemAberto.card.cardId}
          item={itemAberto}
          fases={fases}
          labelsDoTime={labelsDoTime}
          crmDisponivel={crm}
          slaPadrao={slaPadrao}
          podeGerenciarMetas={isAdmin || (Boolean(meuUserId) && itemAberto.jogador?.coachId === meuUserId)}
          onFechar={() => setAbertoId(null)}
          onChange={async () => {
            setAbertoId(null);
            await carregar(true);
          }}
          onErro={onErro}
          onAgendarConversa={() => {
            setAbertoId(null);
            onAgendarConversa(itemAberto.card.playerId);
          }}
          onPromover={async () => {
            if (await promover(itemAberto)) setAbertoId(null);
          }}
        />
      )}

      {modalAdicionar && (
        <ModalAdicionar
          jogadores={semCard}
          fases={fases}
          onFechar={() => setModalAdicionar(false)}
          onChange={async () => {
            setModalAdicionar(false);
            await carregar(true);
          }}
          onErro={onErro}
        />
      )}

      {modalConfig && (
        <ModalConfigFunil
          teamId={teamId}
          fases={fases}
          crmDisponivel={crm}
          slaPadrao={slaPadrao}
          onFechar={() => setModalConfig(false)}
          onChange={() => carregar(true)}
          onErro={onErro}
        />
      )}
    </div>
  );
}
