"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AlertTriangle, Landmark, Plus, ShieldAlert, Wallet } from "lucide-react";
import type { Session, Transaction } from "@/lib/bankroll/types";
import { fmtMoneyIn, suggestFormat } from "@/lib/bankroll/format";
import { PLATFORMS } from "@/lib/bankroll/platforms";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { useConfirm } from "@/components/confirm-dialog";
import { EASE } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { RadarModuleMenu } from "@/components/radar/radar-module-menu";
import { useBanca } from "@/components/banca/use-banca";
import { ABAS_BANCA, type AbaBanca } from "@/components/banca/abas";
import { AbaVisaoGeral } from "@/components/banca/aba-visao-geral";
import { AbaSessoes } from "@/components/banca/aba-sessoes";
import { AbaRisco } from "@/components/banca/aba-risco";
import { AbaDinheiro } from "@/components/banca/aba-dinheiro";
import { AbaRelatorios } from "@/components/banca/aba-relatorios";
import { FormularioSessao } from "@/components/banca/formulario-sessao";
import { FormularioTransacao, ModalAnotacoes } from "@/components/banca/formulario-transacao";
import { AvisoJornadas, ControleCronometro, ModalFimJornada, dataLocal, useCronometro, type Jornada } from "@/components/banca/cronometro";
import { BOTAO_OURO, BOTAO_VIDRO, CAMPO, TIPO_TX, dataBR, haQuanto } from "@/components/banca/util";

// Gestão de Banca no visual novo (o mesmo da tela inicial, da Performance
// e do Time): cards de vidro, números que contam, entrada em sequência,
// explicação ao passar o mouse e menu de 5 abas animado.
//
// No computador cada aba cabe inteira na janela, sem barra de rolagem
// (pedido explícito) -- as listas longas rolam DENTRO do próprio card.
// No celular a página rola normalmente.
//
// Dados e contas moram em components/banca/use-banca.ts; cada aba é um
// arquivo em components/banca/.

export default function BancaPage() {
  const b = useBanca();
  const confirm = useConfirm();
  const [aba, setAbaState] = useState<AbaBanca>("geral");
  const [direcao, setDirecao] = useState(1);
  function setAba(nova: AbaBanca) {
    const de = ABAS_BANCA.findIndex((t) => t.value === aba);
    const para = ABAS_BANCA.findIndex((t) => t.value === nova);
    if (para !== de) setDirecao(para > de ? 1 : -1);
    setAbaState(nova);
  }

  const [sessaoAberta, setSessaoAberta] = useState(false);
  const [editando, setEditando] = useState<Session | null>(null);
  const [txAberta, setTxAberta] = useState(false);
  const [anotacoesAbertas, setAnotacoesAbertas] = useState(false);
  const [inicialSessao, setInicialSessao] = useState<Partial<Session> | null>(null);

  // Cronômetro de sessão (ver components/banca/cronometro.tsx).
  const cron = useCronometro();
  const [jornada, setJornada] = useState<Jornada | null>(null);
  function tirarPendente(j: Jornada) {
    cron.salvarPendentes(cron.pendentes.filter((x) => x.inicioIso !== j.inicioIso));
  }
  // Cada torneio do Radar da jornada ganha uma parte igual do tempo.
  async function dividirHoras(j: Jornada, torneios: Session[]) {
    setJornada(null);
    tirarPendente(j);
    const parte = +(j.horas / torneios.length).toFixed(3);
    for (const t of torneios) await b.salvarSessao({ ...t, hours: parte }, t.id);
  }
  function lancarJornada(j: Jornada) {
    setJornada(null);
    const inicio = new Date(j.inicioIso);
    setEditando(null);
    setInicialSessao({
      date: dataLocal(j.inicioIso),
      time: `${String(inicio.getHours()).padStart(2, "0")}:${String(inicio.getMinutes()).padStart(2, "0")}`,
      hours: j.horas,
    });
    setSessaoAberta(true);
  }

  // Formulário já vem com o formato e a plataforma que o jogador mais usa.
  const sugestoes = useMemo(() => {
    const ultima = [...b.sessoes].reverse().find((s) => s.venue);
    const sala = ultima?.venue && (PLATFORMS as readonly string[]).includes(ultima.venue) ? ultima.venue : PLATFORMS[0];
    return { formato: suggestFormat(b.sessoes), plataforma: sala, moeda: b.moeda };
  }, [b.sessoes, b.moeda]);

  function novaSessao() {
    setEditando(null);
    setInicialSessao(null);
    setSessaoAberta(true);
  }
  function editarSessao(s: Session) {
    setEditando(s);
    setSessaoAberta(true);
  }
  async function excluirSessao(s: Session) {
    const ok = await confirm({
      title: "Excluir sessão?",
      message: `${s.format} de ${dataBR(s.date)}${s.venue ? ` na ${s.venue}` : ""}. As mãos dessa sessão continuam no Revisor.`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (ok) b.removerSessao(s.id);
  }
  async function excluirTransacao(t: Transaction) {
    const ok = await confirm({
      title: `Excluir ${TIPO_TX[t.type].toLowerCase()}?`,
      message: `${fmtMoneyIn(t.amount, t.currency || "BRL")} em ${dataBR(t.date)}.`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (ok) b.removerTransacao(t.id);
  }

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-4 pb-12 pt-6 text-ink md:px-6 tela-cheia:flex tela-cheia:h-full tela-cheia:flex-col tela-cheia:overflow-hidden tela-cheia:pb-4 tela-cheia:pt-4">
            <PerfEstilos />

            {/* Cabeçalho: título, status do Radar e as duas ações do dia a
                dia, com texto (antes eram só ícones). */}
            <header className="mb-3 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gestão de Banca</h1>
                <p className="mt-1 text-[12.5px] text-muted">Sua banca, sessão a sessão. Passe o mouse nos números pra entender cada um.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                <StatusRadar b={b} />
                <RadarModuleMenu
                  module="banca"
                  moduleLabel="a Gestão de Banca"
                  onScopeChange={({ since }) => b.setCorteRadar(since)}
                  onReset={b.zerarImportacoesRadar}
                />
                <ControleCronometro c={cron} alerta={b.hoje.status === "atingido"} onEncerrar={setJornada} />
                <button
                  type="button"
                  onClick={() => setTxAberta(true)}
                  title="Depósito, saque, caixinha, rakeback, bônus ou despesa"
                  className={`${BOTAO_VIDRO} whitespace-nowrap`}
                >
                  <Wallet size={15} /> Movimentação
                </button>
                <button type="button" onClick={novaSessao} className={`${BOTAO_OURO} whitespace-nowrap`}>
                  <Plus size={16} strokeWidth={2.2} /> Registrar sessão
                </button>
              </div>
            </header>

            {/* Abas à esquerda; filtros que valem pra tela toda (plataforma e
                moeda) à direita, perto do conteúdo que eles filtram. */}
            <div className="sticky top-0 z-30 -mx-4 mb-3.5 flex shrink-0 flex-col gap-2 border-b border-white/[0.06] bg-black/70 px-4 pt-1 backdrop-blur-xl md:-mx-6 md:flex-row md:items-center md:justify-between md:px-6">
              <div className="min-w-0">
                <AbasAnimadas value={aba} onChange={setAba} options={ABAS_BANCA} rotulo="Seções da Gestão de Banca" />
              </div>
              {(b.nomesPlataformas.length > 1 || b.multiMoeda) && (
                <div className="flex shrink-0 items-center gap-2 pb-2 md:pb-1">
                  {b.nomesPlataformas.length > 1 && (
                    <label className="relative flex items-center">
                      <Landmark size={14} className="pointer-events-none absolute left-2.5 text-muted" />
                      <select
                        value={b.plataforma}
                        onChange={(e) => b.setPlataforma(e.target.value)}
                        aria-label="Filtrar por plataforma"
                        className={`${CAMPO} !w-auto !py-1.5 !pl-8 text-[12.5px]`}
                      >
                        <option value="todas">Todas as plataformas</option>
                        {b.nomesPlataformas.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {b.multiMoeda && (
                    <select
                      value={b.moeda}
                      onChange={(e) => b.setMoeda(e.target.value)}
                      aria-label="Moeda"
                      title="Os números nunca somam moedas diferentes: escolha qual ver"
                      className={`${CAMPO} !w-auto !py-1.5 text-[12.5px] font-semibold`}
                    >
                      {b.moedas.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {b.erro && <p className="mb-3 shrink-0 rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{b.erro}</p>}
            {b.pendentesAgente.length > 0 && b.erroCotacao && (
              <p className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/[0.07] px-3 py-2 text-[12.5px] text-ink/90">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#f59e0b]" />
                Não consegui buscar a cotação do dólar pra importar {b.pendentesAgente.length}{" "}
                {b.pendentesAgente.length === 1 ? "torneio" : "torneios"} do Radar. Tento de novo sozinho na próxima vez que você abrir esta tela.
              </p>
            )}

            {!b.carregando && (
              <AvisoJornadas pendentes={cron.pendentes} sessoes={b.sessoes} onAplicar={dividirHoras} onDescartar={tirarPendente} />
            )}
            {(b.hoje.status === "perto" || b.hoje.status === "atingido") && b.hoje.limite != null && (
              <p
                className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] text-ink/90"
                style={{
                  borderColor: b.hoje.status === "atingido" ? "rgba(224,85,90,0.4)" : "rgba(245,158,11,0.35)",
                  background: b.hoje.status === "atingido" ? "rgba(224,85,90,0.08)" : "rgba(245,158,11,0.07)",
                }}
              >
                <ShieldAlert size={15} className="mt-0.5 shrink-0" style={{ color: b.hoje.status === "atingido" ? "#e0555a" : "#f59e0b" }} />
                {b.hoje.status === "atingido"
                  ? `Limite de perda do dia atingido: você perdeu ${fmtMoneyIn(-b.hoje.resultado, b.moeda)} hoje (limite ${fmtMoneyIn(b.hoje.limite, b.moeda)}). Hora de parar e voltar amanhã.`
                  : `Perto do limite de perda do dia: ${fmtMoneyIn(-b.hoje.resultado, b.moeda)} de ${fmtMoneyIn(b.hoje.limite, b.moeda)}. Pense bem antes da próxima mesa.`}
              </p>
            )}

            {b.carregando ? (
              <div className="grid gap-3.5 tela-cheia:min-h-0 tela-cheia:flex-1 xl:grid-cols-6 tela-cheia:grid-rows-2">
                <div className="painel-esqueleto h-[280px] rounded-3xl xl:col-span-2 tela-cheia:h-auto" />
                <div className="painel-esqueleto h-[280px] rounded-3xl xl:col-span-4 tela-cheia:h-auto" />
                <div className="painel-esqueleto h-[220px] rounded-3xl xl:col-span-2 tela-cheia:h-auto" />
                <div className="painel-esqueleto h-[220px] rounded-3xl xl:col-span-2 tela-cheia:h-auto" />
                <div className="painel-esqueleto h-[220px] rounded-3xl xl:col-span-2 tela-cheia:h-auto" />
              </div>
            ) : (
              <div className="overflow-x-clip tela-cheia:min-h-0 tela-cheia:flex-1">
                <AnimatePresence mode="wait" custom={direcao} initial={false}>
                  <motion.div
                    key={aba}
                    custom={direcao}
                    initial={{ opacity: 0, x: 28 * direcao }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28 * direcao }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="tela-cheia:h-full"
                  >
                    {aba === "geral" && (
                      <AbaVisaoGeral
                        b={b}
                        onIrPara={setAba}
                        onAnotacoes={() => setAnotacoesAbertas(true)}
                        onEditarSessao={editarSessao}
                      />
                    )}
                    {aba === "sessoes" && <AbaSessoes b={b} onEditar={editarSessao} onExcluir={excluirSessao} />}
                    {aba === "risco" && <AbaRisco b={b} />}
                    {aba === "dinheiro" && <AbaDinheiro b={b} onNovaTransacao={() => setTxAberta(true)} onExcluir={excluirTransacao} />}
                    {aba === "relatorios" && <AbaRelatorios b={b} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            <FormularioSessao
              aberto={sessaoAberta}
              sessao={editando}
              inicial={inicialSessao}
              sugestoes={sugestoes}
              onFechar={() => setSessaoAberta(false)}
              onSalvar={(rascunho, id) => {
                setSessaoAberta(false);
                b.salvarSessao(rascunho, id);
              }}
            />
            <FormularioTransacao
              aberto={txAberta}
              sugestoes={{ plataforma: sugestoes.plataforma, moeda: b.moeda }}
              onFechar={() => setTxAberta(false)}
              onSalvar={(t) => {
                setTxAberta(false);
                b.adicionarTransacao(t);
              }}
            />
            <ModalFimJornada
              jornada={jornada}
              sessoes={b.sessoes}
              onFechar={() => {
                // Fechar sem escolher não perde o tempo: guarda pra depois.
                if (jornada) cron.salvarPendentes([...cron.pendentes, jornada]);
                setJornada(null);
              }}
              onLancarSessao={lancarJornada}
              onAplicarTorneios={dividirHoras}
              onGuardar={(j) => {
                cron.salvarPendentes([...cron.pendentes, j]);
                setJornada(null);
              }}
            />
            <ModalAnotacoes
              aberto={anotacoesAbertas}
              anotacoes={b.anotacoes}
              onFechar={() => setAnotacoesAbertas(false)}
              onAdicionar={b.adicionarAnotacao}
              onRemover={b.removerAnotacao}
            />
          </main>
        </MotionConfig>
      </PainelVisual>
    </AppShell>
  );
}

// Status do Radar PokerSync num selo pequeno (antes ocupava uma faixa
// inteira da tela só pra dizer "Automático").
function StatusRadar({ b }: { b: ReturnType<typeof useBanca> }) {
  const ligado = Boolean(b.agente);
  const cor = b.importando ? "#f59e0b" : ligado ? "#22c55e" : "#6b7280";
  const texto = b.importando
    ? `Importando ${b.pendentesAgente.length} ${b.pendentesAgente.length === 1 ? "torneio" : "torneios"}…`
    : ligado
      ? `Radar ${haQuanto(b.agente!.lastSyncAt)}`
      : "Radar desligado";
  return (
    <InfoHover
      explicacao={{
        titulo: "Importação automática",
        oQueE: ligado
          ? `Mãos e torneios chegam sozinhos pelo Radar PokerSync rodando em “${b.agente!.deviceName}”. Torneios viram sessão aqui, convertidos de dólar pra real pela cotação do dia.`
          : "Instale o Radar PokerSync no seu computador pra importar mãos e torneios automaticamente, sem colar hand history.",
        origem: "Radar PokerSync",
        comoCalcula: ligado ? `Última sincronização ${haQuanto(b.agente!.lastSyncAt)}.` : "Sem ele, dá pra colar hand history em Performance → Importar.",
      }}
    >
      <span className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-ink/85">
        <span className="relative flex h-2 w-2">
          {(ligado || b.importando) && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: cor }} />}
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: cor }} />
        </span>
        {texto}
      </span>
    </InfoHover>
  );
}
