"use client";

import { useEffect, useRef, useState } from "react";
import { Check, HelpCircle, X } from "lucide-react";
import { F } from "@/lib/poker/drill-theme";
import { NOME_RUA } from "./linha-do-tempo";

// Nota rápida por rua ao lado da mesa do Revisor -- pedido explícito:
// avaliar pré-flop/flop/turn/river sem abrir o "Analisar mão", só com os
// botões rápidos, salvando a cada rua. São as MESMAS notas do "Analisar
// mão" (hand_review_street_evals): o que for marcado aqui aparece lá e
// vice-versa. Igual lá, tocar noutra nota troca a nota -- não existe
// "tirar a nota" aqui: apagar a nota da rua apagaria junto a anotação
// escrita pra ela no "Analisar mão", sem a pessoa ver. Só os ícones
// (✓ ✗ ?), sem escrever "Acertei/Errei/Dúvida" -- pedido explícito: "apenas
// o ícone já soluciona" (o nome continua no tooltip e pro leitor de tela).
// Mão de outra pessoa (o coach abrindo a mão que o jogador compartilhou):
// "somenteLeitura" -- mostra só a nota que o JOGADOR deu, sem botões.
//
// Onde fica: no computador, um cartão no rodapé da coluna de mãos (colado
// na mesa, com as 4 ruas); no celular, uma faixa fina logo abaixo da mesa
// com a rua mais recente em que você jogou. A primeira versão ficava
// dentro da faixa de ações embaixo da mesa (computador) e num balão por
// cima da mesa (celular) -- a faixa passava a esconder as ações em telas
// de ~1280px e o balão cobria os assentos de cima em celular baixo
// (iPhone SE) -- por isso a faixa do celular fica embaixo, não em cima.

export const RUAS_AVALIAVEIS = ["preflop", "flop", "turn", "river"] as const;

const NOTAS = [
  { code: "acertei", label: "Acertei", cor: "#10b981", Icone: Check },
  { code: "errei", label: "Errei", cor: "#ef4444", Icone: X },
  { code: "duvida", label: "Fiquei na dúvida", cor: "#f59e0b", Icone: HelpCircle },
] as const;

/** Salva a nota da rua; devolve false se não gravou. */
export type AvaliarRua = (rua: string, nota: string) => Promise<boolean>;

// "Salvo ✓" por um instante depois de gravar -- o pedido era "salvando a
// cada rua", então a tela confirma que gravou (não existe botão de salvar).
function useAvisoSalvo() {
  const [salvo, setSalvo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  function marcar() {
    setSalvo(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSalvo(false), 1600);
  }
  return [salvo, marcar] as const;
}

function BotoesNota({
  nota,
  onAvaliar,
  rotuloRua,
  tamanho,
  bloqueado = false,
}: {
  nota: string;
  onAvaliar: (nota: string) => void;
  rotuloRua: string;
  tamanho: number;
  /** Rua em que a sua jogada ainda não apareceu no replay. */
  bloqueado?: boolean;
}) {
  return (
    <span
      role="group"
      aria-label={`Como você jogou no ${rotuloRua}?`}
      style={{ display: "inline-flex", gap: 4, flexShrink: 0, opacity: bloqueado ? 0.3 : 1 }}
    >
      {NOTAS.map(({ code, label, cor, Icone }) => {
        const ativo = nota === code;
        return (
          <button
            key={code}
            type="button"
            disabled={bloqueado}
            aria-pressed={ativo}
            aria-label={label}
            title={bloqueado ? `Libera quando a sua jogada no ${rotuloRua} aparecer na mesa` : `${label} no ${rotuloRua}`}
            onClick={() => {
              if (!ativo) onAvaliar(code);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: tamanho,
              height: tamanho,
              padding: 0,
              borderRadius: 7,
              cursor: bloqueado ? "not-allowed" : "pointer",
              border: `1px solid ${ativo ? cor : "rgba(255,255,255,0.16)"}`,
              background: ativo ? cor : "rgba(255,255,255,0.03)",
              color: ativo ? "#0A0A0A" : cor,
              transition: "background 150ms ease, border-color 150ms ease",
            }}
          >
            <Icone size={Math.round(tamanho * 0.55)} strokeWidth={2.6} />
          </button>
        );
      })}
    </span>
  );
}

/** Só leitura: a nota que o jogador deu (um ícone só) ou "sem nota". */
function SeloNota({ nota, tamanho }: { nota: string; tamanho: number }) {
  const n = NOTAS.find((x) => x.code === nota);
  if (!n) return <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>sem nota</span>;
  const { label, cor, Icone } = n;
  return (
    <span
      role="img"
      aria-label={`Nota do jogador: ${label}`}
      title={`Nota do jogador: ${label}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        width: tamanho, height: tamanho, borderRadius: 7, border: `1px solid ${cor}`, background: cor, color: "#0A0A0A",
      }}
    >
      <Icone size={Math.round(tamanho * 0.55)} strokeWidth={2.6} />
    </span>
  );
}

/** Computador: cartão com as 4 ruas, no rodapé da coluna de mãos. */
export function CartaoAvaliacao({
  avaliacoes,
  ruasLiberadas,
  fimDaMao,
  onAvaliar,
  somenteLeitura = false,
}: {
  avaliacoes: Record<string, string>;
  /** Ruas em que a sua jogada já apareceu no replay -- só elas aceitam nota. */
  ruasLiberadas: string[];
  fimDaMao: boolean;
  onAvaliar: AvaliarRua;
  /** Mão de outra pessoa: mostra a nota do jogador, sem botões. */
  somenteLeitura?: boolean;
}) {
  const [salvo, marcarSalvo] = useAvisoSalvo();
  const titulo = somenteLeitura ? "Nota do jogador" : "Como você jogou?";
  return (
    <section
      aria-label={titulo}
      style={{
        fontFamily: F,
        flexShrink: 0,
        padding: "10px 14px 12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
          {titulo}
        </span>
        <span aria-live="polite" style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", color: "#34D399" }}>
          {salvo ? "Salvo ✓" : ""}
        </span>
      </div>
      {RUAS_AVALIAVEIS.map((rua) => {
        const rotulo = NOME_RUA[rua.toUpperCase()] ?? rua;
        const liberada = ruasLiberadas.includes(rua);
        return (
          <div key={rua} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 26 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: liberada ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}>
              {rotulo}
            </span>
            {/* No fim da mão, rua sem jogada sua = você não jogou ela
                (antes disso fica só travada, pra não entregar a mão). */}
            {!liberada && fimDaMao ? (
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)" }}>{somenteLeitura ? "não jogou" : "você não jogou"}</span>
            ) : somenteLeitura ? (
              liberada ? (
                <SeloNota nota={avaliacoes[rua] ?? ""} tamanho={26} />
              ) : (
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)" }}>—</span>
              )
            ) : (
              <BotoesNota
                nota={avaliacoes[rua] ?? ""}
                rotuloRua={rotulo}
                tamanho={26}
                bloqueado={!liberada}
                onAvaliar={async (nota) => {
                  if (await onAvaliar(rua, nota)) marcarSalvo();
                }}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Celular: faixa fina embaixo da mesa, com a rua mais recente em que você jogou. */
export function FaixaAvaliacaoCelular({
  avaliacoes,
  ruasLiberadas,
  onAvaliar,
  somenteLeitura = false,
}: {
  avaliacoes: Record<string, string>;
  ruasLiberadas: string[];
  onAvaliar: AvaliarRua;
  /** Mão de outra pessoa: mostra a nota do jogador, sem botões. */
  somenteLeitura?: boolean;
}) {
  const [salvo, marcarSalvo] = useAvisoSalvo();
  // Antes da sua primeira jogada: pré-flop com os botões apagados (igual o
  // cartão do computador), em vez de um aviso escrito.
  const liberada = ruasLiberadas.length > 0;
  const rua = liberada ? ruasLiberadas[ruasLiberadas.length - 1] : "preflop";
  const rotulo = NOME_RUA[rua.toUpperCase()] ?? rua;
  return (
    // zIndex: a caixa (invisível) do assento do hero, que passa um tiquinho
    // da borda de baixo da mesa no celular baixo, não pode roubar o toque.
    <div style={{ height: 44, flexShrink: 0, position: "relative", zIndex: 41, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "3px 3px 3px 14px", borderRadius: 999,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", whiteSpace: "nowrap",
        }}
      >
        <span
          aria-live="polite"
          style={{ minWidth: 52, fontSize: 11.5, fontWeight: 600, color: salvo ? "#34D399" : liberada ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)" }}
        >
          {salvo ? "Salvo ✓" : somenteLeitura ? `Nota do jogador · ${rotulo}` : rotulo}
        </span>
        {somenteLeitura ? (
          <span style={{ display: "inline-flex", alignItems: "center", minHeight: 34, paddingRight: 11 }}>
            {liberada ? <SeloNota nota={avaliacoes[rua] ?? ""} tamanho={28} /> : <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>}
          </span>
        ) : (
          <BotoesNota
            nota={avaliacoes[rua] ?? ""}
            rotuloRua={rotulo}
            tamanho={34}
            bloqueado={!liberada}
            onAvaliar={async (nota) => {
              if (await onAvaliar(rua, nota)) marcarSalvo();
            }}
          />
        )}
      </div>
    </div>
  );
}
