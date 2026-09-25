"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/drill/card";
import { BOTAO_OURO, BOTAO_VIDRO } from "@/components/banca/util";
import { TODAS_AS_MAOS, combosDaMao } from "@/lib/ranges/cartas";
import { pesoDaMao, type Pesos } from "@/lib/ranges/notacao";
import { registrarRespostaTreino } from "@/lib/services/range-service";
import { GradeRange } from "./grade-range";
import { VERDE, VERMELHO } from "./pecas";

// Treino rápido do range aberto: aparece uma mão, você diz se ela está no
// range. Metade das mãos vem de dentro do range e boa parte do resto vem da
// "borda" (vizinhas de uma mão do range) -- é ali que a gente erra.

interface Rodada {
  mao: string;
  combo: string;
  peso: number;
}
type Veredito = "dentro" | "fora" | "misto";

function vizinhas(indice: number): number[] {
  const i = Math.floor(indice / 13);
  const j = indice % 13;
  return [
    [i - 1, j],
    [i + 1, j],
    [i, j - 1],
    [i, j + 1],
  ]
    .filter(([a, b]) => a >= 0 && a < 13 && b >= 0 && b < 13)
    .map(([a, b]) => a * 13 + b);
}

function sortear(pesos: Pesos, pesosCombo: Pesos, anterior: string | null): Rodada | null {
  const peso = TODAS_AS_MAOS.map((m) => pesoDaMao(pesos, pesosCombo, m));
  const dentro = TODAS_AS_MAOS.filter((_, k) => peso[k] > 0);
  if (!dentro.length) return null;
  const fora = TODAS_AS_MAOS.filter((_, k) => peso[k] === 0);
  const borda = TODAS_AS_MAOS.filter((_, k) => peso[k] === 0 && vizinhas(k).some((v) => peso[v] > 0));
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const r = Math.random();
    let grupo = r < 0.5 ? dentro : r < 0.85 ? borda : fora;
    if (!grupo.length) grupo = dentro;
    const mao = grupo[Math.floor(Math.random() * grupo.length)];
    if (mao === anterior && tentativa < 5) continue;
    const combos = combosDaMao(mao);
    const combo = combos[Math.floor(Math.random() * combos.length)];
    return { mao, combo, peso: pesosCombo[combo] ?? pesos[mao] ?? 0 };
  }
  return null;
}

export function TreinoRapido({
  aberto,
  rangeId,
  nome,
  pesos,
  pesosCombo,
  onFechar,
}: {
  aberto: boolean;
  rangeId: string | null;
  nome: string;
  pesos: Pesos;
  pesosCombo: Pesos;
  onFechar: () => void;
}) {
  const [rodada, setRodada] = useState<Rodada | null>(null);
  const [resposta, setResposta] = useState<{ escolha: "dentro" | "fora"; certa: boolean; veredito: Veredito } | null>(null);
  const [placar, setPlacar] = useState({ certas: 0, total: 0, seguidas: 0 });

  const proxima = useCallback(() => {
    setResposta(null);
    setRodada((r) => sortear(pesos, pesosCombo, r?.mao ?? null));
  }, [pesos, pesosCombo]);

  useEffect(() => {
    if (!aberto) return;
    setPlacar({ certas: 0, total: 0, seguidas: 0 });
    setResposta(null);
    setRodada(sortear(pesos, pesosCombo, null));
    // só ao abrir: mexer no range durante o treino não reinicia o placar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const responder = useCallback(
    (escolha: "dentro" | "fora") => {
      if (!rodada || resposta) return;
      const veredito: Veredito = rodada.peso >= 100 ? "dentro" : rodada.peso <= 0 ? "fora" : "misto";
      const certa = veredito === "misto" || veredito === escolha;
      setResposta({ escolha, certa, veredito });
      setPlacar((p) => ({ certas: p.certas + (certa ? 1 : 0), total: p.total + 1, seguidas: certa ? p.seguidas + 1 : 0 }));
      registrarRespostaTreino({ rangeId, rangeNome: nome, mao: rodada.mao, acertou: certa, veredito }).catch(() => {});
    },
    [rodada, resposta, rangeId, nome],
  );

  useEffect(() => {
    if (!aberto) return;
    function tecla(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") responder("dentro");
      else if (e.key === "ArrowRight") responder("fora");
      else if ((e.key === "Enter" || e.key === " ") && resposta) {
        e.preventDefault();
        proxima();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, responder, resposta, proxima]);

  const semModo = useMemo(() => ({ tipo: "range" as const }), []);

  return (
    <Modal open={aberto} onClose={onFechar} title="Treinar esse range" wide>
      {!rodada ? (
        <p className="m-0 text-[13px] text-muted">O range está vazio: pinte algumas mãos na grade antes de treinar.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
            <span className="min-w-0 truncate text-muted">{nome}</span>
            <span className="tnum text-ink/85">
              Acertos <b>{placar.certas}</b>/{placar.total}
              {placar.seguidas >= 3 && <span className="ml-2 text-[#e8cb6a]">{placar.seguidas} seguidas</span>}
            </span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <Card card={rodada.combo.slice(0, 2)} size="hero" />
              <Card card={rodada.combo.slice(2, 4)} size="hero" />
            </div>
            <span className="text-[15px] font-semibold text-ink">{rodada.mao} — essa mão está no range?</span>
          </div>
          {!resposta ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => responder("dentro")} className={`${BOTAO_OURO} py-3`}>
                Está no range
              </button>
              <button type="button" onClick={() => responder("fora")} className={`${BOTAO_VIDRO} py-3`}>
                Fora do range
              </button>
              <p className="col-span-2 m-0 hidden text-center text-[11px] text-muted sm:block">Atalhos: ← está no range · → fora</p>
            </div>
          ) : (
            <>
              <div
                className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px]"
                style={{
                  borderColor: resposta.certa ? "rgba(52,211,153,0.45)" : "rgba(248,113,113,0.45)",
                  background: resposta.certa ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                }}
              >
                {resposta.certa ? <Check size={18} style={{ color: VERDE }} className="mt-px shrink-0" /> : <X size={18} style={{ color: VERMELHO }} className="mt-px shrink-0" />}
                <span className="text-ink/90">
                  <b>{resposta.certa ? "Certo." : "Errou."}</b>{" "}
                  {resposta.veredito === "dentro"
                    ? `${rodada.mao} está no range.`
                    : resposta.veredito === "fora"
                      ? `${rodada.mao} está fora do range.`
                      : `${rodada.mao} é mista: entra ${Math.round(rodada.peso)}% das vezes, então as duas respostas valem.`}
                </span>
              </div>
              <div className="mx-auto w-full max-w-[340px]">
                <GradeRange pesos={pesos} pesosCombo={pesosCombo} modo={semModo} pincel={100} somenteLeitura destacarMao={rodada.mao} />
              </div>
              <button type="button" onClick={proxima} className={`${BOTAO_OURO} py-3`} autoFocus>
                Próxima mão <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
