"use client";

import { useCallback, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { BookOpen, ClipboardPaste, Grid3x3, Layers, Loader2, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { useConfirm } from "@/components/confirm-dialog";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { BOTAO_OURO, BOTAO_VIDRO } from "@/components/banca/util";
import { AbaConstrutor, outroDe } from "@/components/ranges/aba-construtor";
import { AbaFlops } from "@/components/ranges/aba-flops";
import { AbaMeusRanges } from "@/components/ranges/aba-meus-ranges";
import { EscolherRange } from "@/components/ranges/escolher-range";
import { ModalColar } from "@/components/ranges/modal-colar";
import { TreinoRapido } from "@/components/ranges/treino-rapido";
import { useBiblioteca } from "@/components/ranges/use-biblioteca";
import { RANGE_NOVO, deReal, dePronto, deSalvo, useConstrutor, type OutroRange, type RangeAtual } from "@/components/ranges/use-construtor";
import { createClient } from "@/lib/supabase/client";
import { cartaTexto, lerCarta } from "@/lib/ranges/cartas";
import { escreverTextoRange } from "@/lib/ranges/notacao";
import type { ContraOQue } from "@/lib/ranges/link-da-mao";
import type { RangePronto } from "@/lib/ranges/prontos";
import { abrirRange, listarMeusRanges, listarProntos, rangeReal, type AcaoReal, type RangeSalvo } from "@/lib/services/range-service";

// Construtor de Ranges (base Flopzilla): monte um range, coloque o board e
// veja na hora como ele acerta, do pré-flop ao river. Três abas:
// Construtor, Todos os flops e Meus ranges.
//
// Links que abrem a tela já num ponto certo:
//   ?range=<id>            um range salvo (seu ou do time)
//   ?pronto=<spot:ação>    um range pronto do PokerSync (GTO)
//   ?pos=BTN&stack=40      o seu range desse spot, o GTO da mesma situação ou
//                          o seu range de verdade (vem do Revisor, com
//                          &acao=pagar&contra=aumento&vs=SB)
//   ?real=abrir:BTN        o seu range de verdade
//   ?board=Kh9d4s          o board
//   ?aba=flops | meus      a aba

type Aba = "construtor" | "flops" | "meus";
const ABAS = [
  { value: "construtor" as Aba, label: "Construtor", icon: Layers },
  { value: "flops" as Aba, label: "Todos os flops", icon: Grid3x3 },
  { value: "meus" as Aba, label: "Meus ranges", icon: BookOpen },
];

const CONTRAS: ContraOQue[] = ["nada", "limp", "aumento", "allin", "varios"];

/** A situação da mão tem "range de verdade"? (abrir com ninguém no pote;
 *  pagar ou 3-bet contra um aumento só, normal ou all-in). */
function acaoReal(acao: string, contra: ContraOQue): AcaoReal | null {
  if (acao === "abrir" && contra === "nada") return "abrir";
  if ((acao === "pagar" || acao === "3bet") && (contra === "aumento" || contra === "allin")) return acao;
  return null;
}

// Posições que ainda não têm range pronto (GTO): a mais parecida que tem.
const POSICAO_PARECIDA: Record<string, string> = { "UTG+1": "UTG", MP: "UTG", "MP+1": "UTG", LJ: "UTG", HJ: "CO" };

/** O range pronto da MESMA situação da mão: mesma posição, mesma ação e
 *  mesmo "contra" (aumento normal, all-in...), contra o mesmo jogador;
 *  só o stack pode ser o mais perto. Sem um assim, nenhum -- nunca o range
 *  de outra situação (pedido explícito: "não pode trazer nada errado"). */
function prontoDoSpot(prontos: RangePronto[], pos: string, stack: number | null, acao: string, contra: ContraOQue, vs: string | null): RangePronto | null {
  const lista = prontos.filter(
    (p) => p.posicao === pos && p.acao === acao && p.contra === contra && (contra === "nada" || contra === "limp" || p.vsPosicao === vs),
  );
  if (!lista.length) return null;
  const alvo = stack ?? 40;
  return [...lista].sort((a, b) => Math.abs(a.stack - alvo) - Math.abs(b.stack - alvo))[0];
}

/** Um range salvo da pessoa pro mesmo spot: mesma posição e ação, contra o
 *  mesmo jogador quando os dois dizem, stack até 10bb de diferença. */
function meuDoSpot(meus: RangeSalvo[], pos: string, stack: number | null, acao: string, vs: string | null): RangeSalvo | null {
  const lista = meus.filter(
    (r) =>
      r.posicao === pos &&
      r.acao === acao &&
      (!vs || !r.vsPosicao || r.vsPosicao === vs) &&
      (stack == null || r.stack == null || Math.abs(r.stack - stack) <= 10),
  );
  if (!lista.length) return null;
  return [...lista].sort((a, b) => Math.abs((a.stack ?? 40) - (stack ?? 40)) - Math.abs((b.stack ?? 40) - (stack ?? 40)))[0];
}

function lerBoardDaUrl(texto: string | null): string[] {
  if (!texto) return [];
  const pedacos = texto.replace(/[\s,]/g, "").match(/.{1,2}/g) ?? [];
  const cartas = pedacos.map((p) => lerCarta(p)).filter((x): x is NonNullable<typeof x> => !!x).map(cartaTexto);
  const unicas = [...new Set(cartas)];
  return unicas.length >= 3 && unicas.length === cartas.length ? unicas.slice(0, 5) : [];
}

export default function RangesPage() {
  const c = useConstrutor();
  const bib = useBiblioteca();
  const confirm = useConfirm();
  const [aba, setAba] = useState<Aba>("construtor");
  const [iniciado, setIniciado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [comparar, setComparar] = useState<OutroRange | null>(null);
  const [treino, setTreino] = useState<RangeAtual | null>(null);
  const [colar, setColar] = useState(false);
  const [escolherAbrir, setEscolherAbrir] = useState(false);

  // Primeira abertura: o que o link pede (ou o BTN abre · 40bb, pra já
  // começar com algo na grade).
  const { carregar, setBoard } = c;
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const a = q.get("aba");
    if (a === "flops" || a === "meus") setAba(a);
    setBoard(lerBoardDaUrl(q.get("board")));
    (async () => {
      try {
        const id = q.get("range");
        const real = q.get("real");
        const pos = q.get("pos")?.toUpperCase() ?? null;
        if (id) {
          const [r, { data }] = await Promise.all([abrirRange(id), createClient().auth.getSession()]);
          carregar(deSalvo(r, data.session?.user.id ?? null));
          return;
        }
        if (real) {
          const [acao, posReal] = real.split(":");
          if (acao === "abrir" || acao === "pagar" || acao === "3bet") {
            const lista = await rangeReal(acao as AcaoReal);
            const achado = lista.find((x) => x.posicao === posReal?.toUpperCase());
            if (achado) {
              carregar(deReal(achado));
              return;
            }
            setAviso("Ainda não tem mãos importadas suficientes pra montar esse range de verdade.");
          }
        }
        const prontos = await listarProntos();
        const pronto = q.get("pronto");
        if (pronto) {
          const p = prontos.find((x) => x.id === pronto);
          if (p) {
            carregar(dePronto(p));
            return;
          }
        }
        if (pos) {
          const stack = q.get("stack") ? Number(q.get("stack")) : null;
          const acao = q.get("acao");
          const contra = (CONTRAS as string[]).includes(q.get("contra") ?? "") ? (q.get("contra") as ContraOQue) : "nada";
          const vs = q.get("vs")?.toUpperCase() ?? null;
          if (acao) {
            const meu = meuDoSpot(await listarMeusRanges().catch(() => []), pos, stack, acao, vs);
            if (meu) {
              carregar(deSalvo(meu, meu.userId));
              return;
            }
            const p = prontoDoSpot(prontos, pos, stack, acao, contra, vs);
            if (p) {
              carregar(dePronto(p));
              return;
            }
            // Posição sem range pronto: abre o da posição mais parecida.
            const parecida = POSICAO_PARECIDA[pos];
            const p2 = parecida ? prontoDoSpot(prontos, parecida, stack, acao, contra, vs) : null;
            if (p2) {
              carregar(dePronto(p2));
              setAviso(`Ainda não temos range pronto pro ${pos}: abrimos o do ${parecida}, a posição mais parecida.`);
              return;
            }
            // Sem range pronto da situação: o seu range de verdade dela.
            const real = acaoReal(acao, contra);
            if (real) {
              const achado = (await rangeReal(real, contra === "aumento" || contra === "allin" ? contra : null)).find((x) => x.posicao === pos);
              if (achado) {
                carregar(deReal(achado));
                setAviso(`Ainda não temos range pronto do PokerSync pra essa situação: abrimos o que você costuma fazer nela, montado com as suas mãos.`);
                return;
              }
            }
          }
          carregar({ ...RANGE_NOVO });
          setAviso("Ainda não temos range pronto pra essa situação. Abrimos um range em branco pra você montar o seu.");
          return;
        }
        const padrao = prontoDoSpot(prontos, "BTN", 40, "abrir", "nada", null);
        if (padrao) carregar(dePronto(padrao));
      } catch {
        setAviso("Não consegui abrir o range do link. Abrimos um range novo.");
      } finally {
        setIniciado(true);
      }
    })();
  }, [carregar, setBoard]);

  // O endereço acompanha a tela (range, board e aba): dá pra mandar o link.
  useEffect(() => {
    if (!iniciado) return;
    const q = new URLSearchParams();
    if (aba !== "construtor") q.set("aba", aba);
    if (c.range.id) q.set("range", c.range.id);
    else if (c.range.prontoId && !c.alterado) q.set("pronto", c.range.prontoId);
    if (c.board.length) q.set("board", c.board.join(""));
    const texto = q.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${texto ? `?${texto}` : ""}`);
  }, [iniciado, aba, c.range.id, c.range.prontoId, c.alterado, c.board]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const podeTrocar = useCallback(async () => {
    if (!c.alterado || !c.totalCombos) return true;
    return confirm({
      title: "Deixar as mudanças pra trás?",
      message: "Esse range tem mudanças que não foram salvas. Se abrir outro, elas se perdem.",
      confirmLabel: "Abrir mesmo assim",
    });
  }, [c.alterado, c.totalCombos, confirm]);

  const abrir = useCallback(
    async (r: RangeAtual) => {
      if (!(await podeTrocar())) return false;
      c.carregar(r);
      setComparar(null);
      setAba("construtor");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return true;
    },
    [c, podeTrocar],
  );

  async function novo() {
    await abrir({ ...RANGE_NOVO });
  }

  function usarColado(r: { pesos: RangeAtual["pesos"]; pesosCombo: RangeAtual["pesosCombo"] }) {
    const { origem } = c.range;
    if (origem === "pronto" || origem === "real" || origem === "time") {
      c.atualizarDados({ ...RANGE_NOVO, nome: "Range colado", pesos: c.range.pesos, pesosCombo: c.range.pesosCombo });
    }
    c.editar(() => r);
    setAba("construtor");
  }

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-3 pb-12 pt-4 text-ink sm:px-4 sm:pt-6 md:px-6">
            <PerfEstilos />
            <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-[21px] font-semibold tracking-tight sm:text-3xl">Construtor de Ranges</h1>
                <p className="mt-1 text-[12.5px] text-muted">Monte um range, coloque o board e veja na hora como ele acerta. Do pré-flop ao river.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setColar(true)} className={`${BOTAO_VIDRO} whitespace-nowrap`}>
                  <ClipboardPaste size={15} /> Colar range
                </button>
                <button type="button" onClick={novo} className={`${BOTAO_OURO} whitespace-nowrap`}>
                  <Plus size={16} strokeWidth={2.2} /> Novo range
                </button>
              </div>
            </header>

            <div className="sticky top-0 z-30 -mx-3 mb-3.5 border-b border-white/[0.06] bg-black/70 px-3 pt-1 backdrop-blur-xl sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
              <AbasAnimadas value={aba} onChange={setAba} options={ABAS} rotulo="Seções do Construtor de Ranges" atalhos={!treino && !colar && !escolherAbrir} />
            </div>

            {aviso && (
              <p className="mb-3 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/[0.07] px-3 py-2 text-[12.5px] text-ink/90" role="status">
                {aviso}
              </p>
            )}

            {!iniciado ? (
              <p className="m-0 flex items-center justify-center gap-2 py-16 text-[13px] text-muted">
                <Loader2 size={15} className="animate-spin" /> Abrindo o Construtor…
              </p>
            ) : aba === "construtor" ? (
              <AbaConstrutor
                c={c}
                bib={bib}
                comparar={comparar}
                onComparar={setComparar}
                onTrocarRange={() => setEscolherAbrir(true)}
                onTreinar={() => setTreino(c.range)}
                onSalvou={bib.recarregar}
              />
            ) : aba === "flops" ? (
              <AbaFlops
                c={c}
                onTrocarRange={() => setEscolherAbrir(true)}
                onAbrirFlop={(cartas) => {
                  c.setBoard(cartas);
                  setAba("construtor");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ) : (
              <AbaMeusRanges
                bib={bib}
                c={c}
                onAbrir={abrir}
                onComparar={async (r, alvo) => {
                  if (await abrir(r)) setComparar(outroDe(alvo));
                }}
                onTreinar={setTreino}
                onNovo={novo}
              />
            )}

            <EscolherRange
              aberto={escolherAbrir}
              titulo="Abrir range"
              bib={bib}
              onEscolher={async (r) => {
                setEscolherAbrir(false);
                await abrir(r);
              }}
              onFechar={() => setEscolherAbrir(false)}
            />
            <ModalColar aberto={colar} textoAtual={escreverTextoRange(c.range.pesos, c.range.pesosCombo)} onUsar={usarColado} onFechar={() => setColar(false)} />
            <TreinoRapido
              aberto={!!treino}
              rangeId={treino?.id ?? null}
              nome={treino?.nome ?? ""}
              pesos={treino?.pesos ?? {}}
              pesosCombo={treino?.pesosCombo ?? {}}
              acao={treino?.acao ?? null}
              onFechar={() => setTreino(null)}
            />
          </main>
        </MotionConfig>
      </PainelVisual>
    </AppShell>
  );
}
