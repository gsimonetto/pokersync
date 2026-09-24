"use client";

import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, BadgePercent, Coins, Gift, Landmark, PiggyBank, Plus, Receipt, Trash2, TrendingUp, Wrench } from "lucide-react";
import type { Transaction, TransactionType } from "@/lib/bankroll/types";
import { sinalTransacao } from "@/lib/bankroll/calc";
import { fmtMoneyIn, fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { consolidarEmReais } from "@/lib/bankroll/consolidado";
import { EASE, Linha, Numero, PainelCard, TileIcone } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";
import type { Banca } from "./use-banca";
import { BOTAO_VIDRO, COR_NEGATIVO, COR_POSITIVO, COR_TX, COR_UNICA, TIPO_TX, dataCurta, nomeCategoria, num1 } from "./util";

// Aba "Dinheiro": onde está o dinheiro (por plataforma e por moeda) e o
// que entrou/saiu. Nada daqui é resultado de jogo -- é o caixa.
//
//   ┌──────── Saldo por plataforma (4) ────────┐┌ Lucro real (2) ───────┐
//   ┌ Movimentações (2) ┐┌ Entradas e saídas (2) ┐┌ Suas moedas (2) ──┐

const ICONE_TX: Record<TransactionType, React.ReactNode> = {
  deposito: <ArrowDownLeft size={15} />,
  saque: <ArrowUpRight size={15} />,
  caixinha: <PiggyBank size={15} />,
  rakeback: <BadgePercent size={15} />,
  bonus: <Gift size={15} />,
  despesa: <Wrench size={15} />,
};

export function AbaDinheiro({ b, onNovaTransacao, onExcluir }: { b: Banca; onNovaTransacao: () => void; onExcluir: (t: Transaction) => void }) {
  const fmt = (v: number) => fmtMoneyIn(v, b.moeda);
  const totalPositivo = b.plataformas.reduce((t, p) => t + Math.max(0, p.balance), 0);
  const movs = [...b.transacoesFiltradas].sort((x, y) => y.date.localeCompare(x.date));
  const c = consolidarEmReais(b.saldosMoedas, b.cambio.taxaParaBRL);
  const despesasPorCategoria = Object.entries(
    b.transacoesFiltradas
      .filter((t) => t.type === "despesa")
      .reduce<Record<string, number>>((acc, t) => ({ ...acc, [nomeCategoria(t.category)]: (acc[nomeCategoria(t.category)] ?? 0) + (Number(t.amount) || 0) }), {}),
  )
    .map(([nome, total]) => ({ nome, total }))
    .sort((x, y) => y.total - x.total);

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 tela-cheia:h-full xl:grid-cols-6 tela-cheia:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------------- Saldo por plataforma ---------------- */}
      <PainelCard title="Saldo por plataforma" icon={<Landmark size={15} />} ordem={0} className="md:col-span-2 xl:col-span-4 tela-cheia:min-h-0">
        {b.plataformas.length === 0 ? (
          <p className="text-sm text-muted">Registre sessões ou depósitos com a plataforma pra ver quanto tem em cada uma.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {b.plataformas.map((p, i) => {
              const parte = totalPositivo > 0 ? (Math.max(0, p.balance) / totalPositivo) * 100 : 0;
              return (
                <motion.li key={p.platform} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.2 + i * 0.05 }}>
                  <InfoHover
                    className="h-full"
                    explicacao={{
                      titulo: p.platform,
                      oQueE: "Quanto você tem nessa plataforma: resultado das sessões jogadas nela + entradas (depósito, rakeback, bônus) − saídas (saque, caixinha).",
                      origem: "Gestão de Banca · sessões e movimentações com essa plataforma",
                      itens: [
                        { rotulo: `Resultado (${p.sessionsN} sessões)`, valor: fmtSignedMoneyIn(p.sessionsNet, b.moeda) },
                        { rotulo: "Depósitos, rakeback e bônus", valor: fmt(p.deposits) },
                        { rotulo: "Saques e caixinha", valor: fmt(p.withdrawn) },
                      ],
                    }}
                  >
                    <Linha className="flex h-full flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink/90">{p.platform}</span>
                        <span className="text-[11px] tabular-nums text-muted">{Math.round(parte)}%</span>
                      </div>
                      <p className="tnum text-[22px] font-bold leading-none" style={{ color: p.balance < 0 ? COR_NEGATIVO : "#fff" }}>
                        <Numero valor={p.balance} formatar={fmt} />
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: COR_UNICA }}
                          initial={{ width: 0 }}
                          animate={{ width: `${parte}%` }}
                          transition={{ duration: 0.8, ease: EASE, delay: 0.35 + i * 0.05 }}
                        />
                      </div>
                      <p className="text-[11px] text-muted">
                        Jogo <span style={{ color: p.sessionsNet >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>{fmtSignedMoneyIn(p.sessionsNet, b.moeda)}</span> · {p.sessionsN}{" "}
                        {p.sessionsN === 1 ? "sessão" : "sessões"}
                      </p>
                    </Linha>
                  </InfoHover>
                </motion.li>
              );
            })}
          </ul>
        )}
      </PainelCard>

      {/* ---------------- Lucro real ---------------- */}
      <PainelCard title="Lucro real" icon={<TrendingUp size={15} />} ordem={1} className="md:col-span-2 xl:col-span-2 tela-cheia:min-h-0">
        <div className="flex flex-col gap-2">
          <InfoHover
            explicacao={{
              titulo: "Lucro real",
              oQueE: "O que o poker te deu de verdade: o resultado das mesas, mais o que veio fora delas (rakeback, bônus), menos o que você gastou pra jogar (coach, software, viagem).",
              origem: "Gestão de Banca · sessões e movimentações",
              comoCalcula: "Resultado das sessões + rakeback + bônus − despesas. Depósito, saque e caixinha não entram: só movem dinheiro.",
            }}
          >
            <div className="rounded-2xl border border-[#d4af37]/25 p-3" style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.12), transparent)" }}>
              <p className="tnum text-[28px] font-bold leading-none" style={{ color: b.patrimonio.lucroReal >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                {fmtSignedMoneyIn(b.patrimonio.lucroReal, b.moeda)}
              </p>
              {b.agg.totalInvested > 0 && (
                <p className="mt-1.5 text-[11.5px] text-muted">
                  ROI com extras e despesas: <span className="font-semibold text-ink">{num1((b.patrimonio.lucroReal / b.agg.totalInvested) * 100)}%</span>
                </p>
              )}
            </div>
          </InfoHover>
          <Movimento icone={<Landmark size={16} />} cor="#c4c7c8" rotulo="Resultado das mesas" valor={fmtSignedMoneyIn(b.agg.profit, b.moeda)} />
          <Movimento icone={<BadgePercent size={16} />} cor={COR_UNICA} rotulo="Rakeback e bônus" valor={`+${fmt(b.patrimonio.extras)}`} />
          <Movimento icone={<Wrench size={16} />} cor={COR_TX.despesa} rotulo="Despesas" valor={`−${fmt(b.patrimonio.despesas)}`} />
          {despesasPorCategoria.length > 0 && (
            <p className="px-1 text-[11px] text-muted">
              {despesasPorCategoria.map((d) => `${d.nome} ${fmt(d.total)}`).join(" · ")}
            </p>
          )}
        </div>
      </PainelCard>

      {/* ---------------- Movimentações ---------------- */}
      <PainelCard
        title={`Movimentações (${movs.length})`}
        icon={<Receipt size={15} />}
        ordem={2}
        className="md:col-span-2 xl:col-span-2 tela-cheia:min-h-0"
        action={
          <button type="button" onClick={onNovaTransacao} className={`${BOTAO_VIDRO} !px-2.5 !py-1.5 text-[12px]`}>
            <Plus size={14} /> Nova
          </button>
        }
      >
        {movs.length === 0 ? (
          <p className="text-sm text-muted">Nenhum depósito, saque ou caixinha registrado.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {movs.map((t) => (
              <li key={t.id}>
                <Linha className="group/linha flex items-center gap-3 !py-2.5">
                  <TileIcone cor={COR_TX[t.type]}>{ICONE_TX[t.type]}</TileIcone>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">
                      {TIPO_TX[t.type]} <span className="font-normal text-muted">· {dataCurta(t.date)}</span>
                    </p>
                    <p className="truncate text-[11.5px] text-muted">
                      {[t.type === "despesa" ? nomeCategoria(t.category) : t.venue || "Sem plataforma", t.note].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums" style={{ color: sinalTransacao(t) > 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                    {sinalTransacao(t) > 0 ? "+" : "−"}
                    {fmtMoneyIn(t.amount, t.currency || b.moeda)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExcluir(t)}
                    aria-label="Excluir movimentação"
                    title="Excluir movimentação"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-negative md:opacity-0 md:group-hover/linha:opacity-100 md:focus:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </Linha>
              </li>
            ))}
          </ul>
        )}
      </PainelCard>

      {/* ---------------- Entradas e saídas ---------------- */}
      <PainelCard title="Entradas e saídas" icon={<Receipt size={15} />} ordem={3} className="xl:col-span-2 tela-cheia:min-h-0">
        <div className="flex flex-col gap-2">
          <Movimento icone={<ArrowDownLeft size={16} />} cor={COR_POSITIVO} rotulo="Depositado" valor={fmt(b.patrimonio.deposits)} />
          <Movimento icone={<ArrowUpRight size={16} />} cor={COR_NEGATIVO} rotulo="Sacado" valor={fmt(b.patrimonio.withdrawn)} />
          <Movimento icone={<PiggyBank size={16} />} cor="#f59e0b" rotulo="Na caixinha" valor={fmt(b.patrimonio.caixinha)} />
          <InfoHover
            explicacao={{
              titulo: "Patrimônio no poker",
              oQueE: "Tudo que o poker já te deu, inclusive o que você sacou ou guardou. Saque e caixinha não são perda: só saem da banca de jogo.",
              origem: "Gestão de Banca",
              comoCalcula: "Banca inicial + depósitos + lucro real.",
            }}
          >
            <Linha className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] text-muted">Patrimônio no poker</span>
              <span className="tnum text-[16px] font-bold text-ink">{fmt(b.patrimonio.netWorth)}</span>
            </Linha>
          </InfoHover>
        </div>
      </PainelCard>

      {/* ---------------- Moedas ---------------- */}
      <PainelCard title="Suas moedas" icon={<Coins size={15} />} ordem={4} className="xl:col-span-2 tela-cheia:min-h-0">
        <div className="flex flex-col gap-2">
          {b.saldosMoedas.length === 0 && <p className="text-sm text-muted">Sem saldo registrado ainda.</p>}
          {b.saldosMoedas.map((m) => {
            const taxa = b.cambio.taxaParaBRL(m.moeda);
            return (
              <Linha key={m.moeda} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{m.moeda}</span>
                  <span className="tnum text-[16px] font-bold text-ink">{fmtMoneyIn(m.saldo, m.moeda)}</span>
                </div>
                {m.moeda !== "BRL" && (
                  <label className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
                    <span>
                      1 {m.moeda} =
                      <input
                        inputMode="decimal"
                        value={b.cambio.manuais[m.moeda] ?? ""}
                        onChange={(e) => b.cambio.definirTaxa(m.moeda, e.target.value)}
                        placeholder={m.moeda === "USD" && b.cambio.usdDoDia ? b.cambio.usdDoDia.toFixed(2) : "0,00"}
                        className="mx-1.5 w-16 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-center tabular-nums text-ink outline-none focus:border-[#d4af37]/60"
                      />
                      BRL
                    </span>
                    <span className="tabular-nums text-ink/80">{taxa != null ? `≈ ${fmtMoneyIn(m.saldo * taxa, "BRL")}` : "sem cotação"}</span>
                  </label>
                )}
              </Linha>
            );
          })}
          {b.saldosMoedas.some((m) => m.moeda !== "BRL") && (
            <InfoHover
              explicacao={{
                titulo: "Total em reais",
                oQueE: "Todas as moedas somadas em reais. É esse número que aparece como “Banca total” na tela inicial.",
                origem: "Gestão de Banca",
                comoCalcula: "Dólar pela cotação do dia (ou pela taxa que você digitar). Outras moedas usam a taxa digitada.",
              }}
            >
              <div className="rounded-2xl border border-[#d4af37]/25 p-3" style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.12), transparent)" }}>
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted">Total em reais (estimado)</p>
                <p className="tnum mt-1 text-[22px] font-bold text-ink">{c.total != null ? fmtMoneyIn(c.total, "BRL") : "—"}</p>
                {c.semCotacao.length > 0 && <p className="mt-1 text-[11px] text-muted">Sem cotação: {c.semCotacao.join(", ")} (digite a taxa acima).</p>}
              </div>
            </InfoHover>
          )}
        </div>
      </PainelCard>
    </div>
  );
}

function Movimento({ icone, cor, rotulo, valor }: { icone: React.ReactNode; cor: string; rotulo: string; valor: string }) {
  return (
    <Linha className="flex items-center gap-3 !py-2.5">
      <TileIcone cor={cor}>{icone}</TileIcone>
      <span className="flex-1 text-[12.5px] text-muted">{rotulo}</span>
      <span className="tnum text-[15px] font-semibold text-ink">{valor}</span>
    </Linha>
  );
}
