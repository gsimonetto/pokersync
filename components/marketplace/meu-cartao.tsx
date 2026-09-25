"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, ChevronDown, Users } from "lucide-react";
import { PlayerBadge, crachaDoMeuCartao } from "@/components/time/player-badge";
import { Rotulo } from "@/components/ranges/pecas";
import { abrirConfiguracoes } from "@/lib/eventos-perfil";
import type { MeuCartao } from "@/lib/services/marketplace-service";
import { Interruptor, OURO_CLARO } from "./pecas";

// "Como os times te veem": o mesmo crachá que o time vê quando a pessoa
// se candidata, o "Procurando time" (aviso de vaga compatível) e o que
// ainda falta pro cartão ficar completo -- quanto mais completo, mais
// certo o match.

interface ItemCompleto {
  ok: boolean;
  texto: string;
  acao: { texto: string; href?: string; onClick?: () => void };
}

function itens(c: MeuCartao): ItemCompleto[] {
  const dias = c.diasTreinoSemana?.length ?? 0;
  return [
    {
      ok: c.maos > 0,
      texto: c.maos > 0 ? `Mãos importadas (${c.maos.toLocaleString("pt-BR")})` : "Mãos importadas",
      acao: { texto: "Importar", href: "/revisor" },
    },
    {
      ok: (c.numSessoes ?? 0) > 0,
      texto: "Resultados na Gestão de Banca",
      acao: { texto: "Registrar", href: "/banca" },
    },
    {
      ok: (c.numDrills ?? 0) > 0,
      texto: (c.numDrills ?? 0) > 0 ? `Treinos no PokerSync (${c.numDrills})` : "Treinos no PokerSync",
      acao: { texto: "Treinar", href: "/treino" },
    },
    {
      ok: Boolean(c.horarioTreino) && dias > 0,
      texto: "Horários e dias de jogo",
      acao: { texto: "Preencher", onClick: abrirConfiguracoes },
    },
  ];
}

export function completude(c: MeuCartao): { feitos: number; total: number } {
  const lista = itens(c);
  return { feitos: lista.filter((i) => i.ok).length, total: lista.length };
}

function Lista({ c }: { c: MeuCartao }) {
  const lista = itens(c);
  const feitos = lista.filter((i) => i.ok).length;
  return (
    <div>
      <p className="m-0 text-[12px] leading-snug text-muted">
        {feitos === lista.length ? (
          <>
            Seu cartão está <b className="text-ink/90">completo</b>. É ele que os times olham primeiro.
          </>
        ) : (
          <>
            Seu cartão está{" "}
            <b className="text-ink/90">
              {feitos} de {lista.length}
            </b>{" "}
            completo — quanto mais completo, mais certo o match.
          </>
        )}
      </p>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[12.5px]">
        {lista.map((x) => (
          <li key={x.acao.texto} className="flex items-center gap-2">
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${x.ok ? "bg-[#34D399]/20 text-[#34D399]" : "bg-white/10 text-muted"}`}>
              {x.ok ? <Check size={10} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-muted" />}
            </span>
            <span className={`min-w-0 truncate ${x.ok ? "text-ink/85" : "text-muted"}`}>{x.texto}</span>
            {!x.ok &&
              (x.acao.href ? (
                <Link href={x.acao.href} className="ml-auto shrink-0 font-semibold hover:underline" style={{ color: OURO_CLARO }}>
                  {x.acao.texto} ›
                </Link>
              ) : (
                <button type="button" onClick={x.acao.onClick} className="ml-auto shrink-0 font-semibold hover:underline" style={{ color: OURO_CLARO }}>
                  {x.acao.texto} ›
                </button>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Procurando({
  ligado,
  onChange,
  salvando,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  salvando: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/[0.07] px-3 py-2.5">
      <span className="flex min-w-0 items-start gap-2">
        <BellRing size={16} className="mt-0.5 shrink-0" style={{ color: OURO_CLARO }} />
        <span className="text-[12.5px] leading-snug text-ink/90">
          <b>Procurando time</b>
          <br />
          <span className="text-muted">{ligado ? "Te avisamos quando surgir vaga com match alto." : "Ligue pra ser avisado de vaga com match alto."}</span>
        </span>
      </span>
      <Interruptor ligado={ligado} onChange={onChange} disabled={salvando} rotulo="Procurando time" />
    </div>
  );
}

function NoTime({ nomeTime }: { nomeTime: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12.5px] leading-snug text-muted">
      <Users size={15} className="mt-0.5 shrink-0 text-ink/70" />
      <span>
        Você joga pelo <b className="text-ink/90">{nomeTime}</b>. Pra entrar em outro time, é preciso sair dele antes.
      </span>
    </div>
  );
}

/** Cartão completo (coluna da esquerda no computador). */
export function SeuCartao({
  cartao,
  nomeTime,
  onProcurando,
  salvando = false,
}: {
  cartao: MeuCartao;
  /** Time atual da pessoa (se tiver): troca o "Procurando time" por um aviso. */
  nomeTime?: string | null;
  onProcurando: (v: boolean) => void;
  salvando?: boolean;
}) {
  return (
    <section className="painel-vidro flex flex-col gap-3 rounded-2xl border border-white/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <Rotulo>Como os times te veem</Rotulo>
        <button type="button" onClick={abrirConfiguracoes} className="text-[11.5px] font-semibold hover:underline" style={{ color: OURO_CLARO }}>
          Editar
        </button>
      </div>
      <PlayerBadge dados={crachaDoMeuCartao(cartao)} variante="cartao" animar={false} />
      {nomeTime ? <NoTime nomeTime={nomeTime} /> : <Procurando ligado={cartao.procurandoVaga} onChange={onProcurando} salvando={salvando} />}
      <Lista c={cartao} />
    </section>
  );
}

/** Faixa curta (celular): crachá compacto, Procurando e o cartão abrindo embaixo. */
export function FaixaCartao({
  cartao,
  nomeTime,
  onProcurando,
  salvando = false,
}: {
  cartao: MeuCartao;
  nomeTime?: string | null;
  onProcurando: (v: boolean) => void;
  salvando?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const { feitos, total } = completude(cartao);
  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-3 lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <PlayerBadge dados={crachaDoMeuCartao(cartao)} variante="compacto" animar={false} />
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          {!nomeTime && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <BellRing size={12} style={{ color: OURO_CLARO }} /> Procurando
              <Interruptor ligado={cartao.procurandoVaga} onChange={onProcurando} disabled={salvando} rotulo="Procurando time" />
            </span>
          )}
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
            style={{ color: OURO_CLARO }}
          >
            Cartão {feitos} de {total}
            <ChevronDown size={13} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
          </button>
        </span>
      </div>
      {aberto && (
        <div className="mt-3 flex flex-col gap-3 border-t border-white/[0.06] pt-3">
          {nomeTime && <NoTime nomeTime={nomeTime} />}
          <Lista c={cartao} />
        </div>
      )}
    </section>
  );
}
