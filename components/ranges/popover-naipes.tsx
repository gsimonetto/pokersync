"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { combosDaMao } from "@/lib/ranges/cartas";
import type { Pesos } from "@/lib/ranges/notacao";
import { CartaTexto } from "./pecas";

// Naipes de uma mão (botão direito ou dedo parado numa célula da grade):
// liga e desliga cada combo -- "AKs só de espadas e copas", "KK sem o K♠".

/** Liga/desliga um combo e deixa o dado limpo (sem ajuste que não muda nada). */
export function mudarCombo(pesos: Pesos, pesosCombo: Pesos, mao: string, combo: string, ligado: boolean): { pesos: Pesos; pesosCombo: Pesos } {
  const combos = combosDaMao(mao);
  const pesoMao = pesos[mao] ?? 0;
  const pc = { ...pesosCombo, [combo]: ligado ? (pesoMao > 0 ? pesoMao : 100) : 0 };
  const valores = combos.map((c) => pc[c] ?? pesoMao);
  const p = { ...pesos };
  if (valores.every((v) => v === valores[0])) {
    combos.forEach((c) => delete pc[c]);
    if (valores[0] > 0) p[mao] = valores[0];
    else delete p[mao];
  } else combos.forEach((c) => pc[c] === pesoMao && delete pc[c]);
  return { pesos: p, pesosCombo: pc };
}

/** A mão inteira com um peso só (apaga os ajustes de naipe dela). */
export function mudarMao(pesos: Pesos, pesosCombo: Pesos, mao: string, valor: number): { pesos: Pesos; pesosCombo: Pesos } {
  const p = { ...pesos };
  if (valor > 0) p[mao] = valor;
  else delete p[mao];
  const combos = combosDaMao(mao);
  if (!combos.some((c) => c in pesosCombo)) return { pesos: p, pesosCombo };
  const pc = { ...pesosCombo };
  combos.forEach((c) => delete pc[c]);
  return { pesos: p, pesosCombo: pc };
}

export function PopoverNaipes({
  mao,
  ancora,
  pesos,
  pesosCombo,
  onMudar,
  onFechar,
}: {
  mao: string;
  ancora: DOMRect;
  pesos: Pesos;
  pesosCombo: Pesos;
  onMudar: (r: { pesos: Pesos; pesosCombo: Pesos }) => void;
  onFechar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const combos = combosDaMao(mao);
  const colunas = combos.length === 12 ? 4 : combos.length === 6 ? 3 : 4;

  useEffect(() => {
    function fora(e: PointerEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) onFechar();
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    // no próximo ciclo: o mesmo toque que abriu não fecha
    const t = setTimeout(() => window.addEventListener("pointerdown", fora), 0);
    window.addEventListener("keydown", tecla);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", tecla);
    };
  }, [onFechar]);

  const largura = 252;
  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  const left = Math.max(8, Math.min(vw - largura - 8, ancora.left + ancora.width / 2 - largura / 2));
  const abaixo = ancora.bottom + 8;
  const top = abaixo + 190 > vh ? Math.max(8, ancora.top - 198) : abaixo;
  const ligados = combos.filter((c) => (pesosCombo[c] ?? pesos[mao] ?? 0) > 0).length;

  return (
    <ModalPortal>
      <div
        ref={caixa}
        role="dialog"
        aria-label={`Naipes de ${mao}`}
        className="fixed z-[70] rounded-2xl border border-white/12 bg-[#101114]/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl"
        style={{ left, top, width: largura }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[14px] font-semibold text-ink">{mao}</span>
            <span className="ml-2 text-[11.5px] text-muted">
              {ligados} de {combos.length} combos no range
            </span>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink">
            <X size={15} />
          </button>
        </div>
        <div className="mt-2.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
          {combos.map((c) => {
            const ligado = (pesosCombo[c] ?? pesos[mao] ?? 0) > 0;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={ligado}
                onClick={() => onMudar(mudarCombo(pesos, pesosCombo, mao, c, !ligado))}
                className="rounded-lg border px-1 py-1.5 text-[12.5px] transition active:scale-[0.97]"
                style={{
                  borderColor: ligado ? "rgba(212,175,55,0.65)" : "rgba(255,255,255,0.10)",
                  background: ligado ? "rgba(212,175,55,0.14)" : "rgba(255,255,255,0.02)",
                  opacity: ligado ? 1 : 0.55,
                }}
              >
                <CartaTexto carta={c.slice(0, 2)} />
                <CartaTexto carta={c.slice(2, 4)} />
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <button
            type="button"
            onClick={() => onMudar(mudarMao(pesos, pesosCombo, mao, 100))}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-[12px] font-semibold text-ink/90 hover:bg-white/[0.07]"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => onMudar(mudarMao(pesos, pesosCombo, mao, 0))}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-[12px] font-semibold text-ink/90 hover:bg-white/[0.07]"
          >
            Nenhum
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
