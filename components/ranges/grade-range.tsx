"use client";

import { useMemo, useRef } from "react";
import { TODAS_AS_MAOS, combosDaMao } from "@/lib/ranges/cartas";
import { pesoDaMao, type Pesos } from "@/lib/ranges/notacao";
import { corEquidade } from "./pecas";

// Grade 13x13 do Construtor. Pinta clicando ou arrastando (no celular:
// toque numa mão, ou arraste de lado); botão direito (ou segurar o dedo)
// abre os naipes da mão. Além do range, ela mostra por cima o que o painel
// pede: as mãos de uma categoria (azul subindo), a equidade de cada mão ou
// a comparação com outro range.

export type ModoGrade =
  | { tipo: "range" }
  | { tipo: "destaque"; fracao: Record<string, number>; cor: string }
  | { tipo: "equidade"; eq: Record<string, number> }
  | { tipo: "comparar"; outro: { pesos: Pesos; pesosCombo: Pesos } };

export const COR_SO_SEU = "#34D399";
export const COR_SO_OUTRO = "#F87171";

interface Traco {
  id: string;
  valor: number;
  pintadas: Set<string>;
  toque: boolean;
  inicio: string;
  moveu: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function GradeRange({
  pesos,
  pesosCombo,
  modo,
  pincel,
  onPintar,
  onNaipes,
  onPassar,
  somenteLeitura = false,
  destacarMao = null,
  compacta = true,
}: {
  pesos: Pesos;
  pesosCombo: Pesos;
  modo: ModoGrade;
  /** Peso que o pincel pinta (0 = tirar do range). */
  pincel: number;
  onPintar?: (maos: string[], valor: number, traco: string) => void;
  onNaipes?: (mao: string, ancora: DOMRect) => void;
  onPassar?: (mao: string | null) => void;
  somenteLeitura?: boolean;
  destacarMao?: string | null;
  compacta?: boolean;
}) {
  const traco = useRef<Traco | null>(null);

  const celulas = useMemo(
    () =>
      TODAS_AS_MAOS.map((mao) => {
        const p = pesoDaMao(pesos, pesosCombo, mao);
        const temCombo = combosDaMao(mao).some((c) => c in pesosCombo);
        let fundo = "rgba(255,255,255,0.035)";
        let cor = "rgba(255,255,255,0.3)";
        let preenche: { cor: string; altura: number } | null = null;
        let extra: string | null = null;
        if (modo.tipo === "range") {
          if (p > 0) {
            preenche = { cor: "rgba(212,175,55,0.9)", altura: p };
            cor = p >= 60 ? "#1b1606" : "#FFFFFF";
          }
        } else if (modo.tipo === "destaque") {
          // só as mãos que chegaram nessa rua entram na conta
          const f = modo.fracao[mao];
          if (f !== undefined) {
            fundo = "rgba(212,175,55,0.16)";
            cor = f > 0 ? "#FFFFFF" : "rgba(255,255,255,0.5)";
            if (f > 0) preenche = { cor: modo.cor, altura: f * 100 };
          }
        } else if (modo.tipo === "equidade") {
          if (p > 0) {
            const e = modo.eq[mao];
            if (e != null) {
              fundo = corEquidade(e);
              cor = "#0b0b0b";
              extra = `${Math.round(e)}`;
            } else fundo = "rgba(255,255,255,0.12)";
          }
        } else {
          const q = pesoDaMao(modo.outro.pesos, modo.outro.pesosCombo, mao);
          if (p > 0 && q > 0) {
            fundo = "rgba(212,175,55,0.88)";
            cor = "#1b1606";
          } else if (p > 0) {
            fundo = COR_SO_SEU;
            cor = "#0b0b0b";
          } else if (q > 0) {
            fundo = COR_SO_OUTRO;
            cor = "#0b0b0b";
          }
        }
        return { mao, p, temCombo, fundo, cor, preenche, extra };
      }),
    [pesos, pesosCombo, modo],
  );

  const pesoDe = (mao: string) => celulas.find((c) => c.mao === mao)?.p ?? 0;

  function celulaEm(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return el?.closest<HTMLElement>("[data-mao]")?.dataset.mao ?? null;
  }

  function pintar(maos: string[]) {
    const t = traco.current;
    if (!t || !onPintar) return;
    const novas = maos.filter((m) => !t.pintadas.has(m));
    if (!novas.length) return;
    novas.forEach((m) => t.pintadas.add(m));
    onPintar(novas, t.valor, t.id);
  }

  function fim() {
    const t = traco.current;
    if (t?.timer) clearTimeout(t.timer);
    traco.current = null;
  }

  return (
    <div
      role="grid"
      aria-label="Grade de mãos. Clique ou arraste pra pintar; botão direito (ou segure o dedo) pra escolher os naipes."
      className="grid select-none gap-[3px]"
      style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))", touchAction: somenteLeitura ? "auto" : "pan-y" }}
      onPointerDown={(e) => {
        if (somenteLeitura || !onPintar) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const mao = (e.target as HTMLElement).closest<HTMLElement>("[data-mao]")?.dataset.mao;
        if (!mao) return;
        fim();
        const atual = Math.round(pesoDe(mao));
        const valor = pincel > 0 && atual === pincel ? 0 : pincel;
        const toque = e.pointerType !== "mouse";
        const t: Traco = { id: `${Date.now()}-${mao}`, valor, pintadas: new Set(), toque, inicio: mao, moveu: false, timer: null };
        traco.current = t;
        if (toque) {
          // Segurar o dedo parado = abrir os naipes (sem pintar).
          t.timer = setTimeout(() => {
            if (traco.current !== t || t.moveu) return;
            const el = document.querySelector<HTMLElement>(`[data-mao="${mao}"]`);
            if (el && onNaipes) onNaipes(mao, el.getBoundingClientRect());
            traco.current = null;
          }, 480);
        } else {
          e.currentTarget.setPointerCapture(e.pointerId);
          pintar([mao]);
        }
      }}
      onPointerMove={(e) => {
        const t = traco.current;
        if (!t) {
          if (onPassar && e.pointerType === "mouse") onPassar(celulaEm(e.clientX, e.clientY));
          return;
        }
        const mao = celulaEm(e.clientX, e.clientY);
        if (!mao) return;
        if (t.toque && !t.moveu) {
          if (mao === t.inicio) return;
          t.moveu = true;
          if (t.timer) clearTimeout(t.timer);
          pintar([t.inicio, mao]);
          return;
        }
        pintar([mao]);
        onPassar?.(mao);
      }}
      onPointerUp={() => {
        const t = traco.current;
        if (t?.toque && !t.moveu) pintar([t.inicio]);
        fim();
      }}
      onPointerCancel={fim}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && !traco.current) onPassar?.(null);
      }}
      onContextMenu={(e) => {
        const alvo = (e.target as HTMLElement).closest<HTMLElement>("[data-mao]");
        if (!alvo || somenteLeitura || !onNaipes) return;
        e.preventDefault();
        fim();
        onNaipes(alvo.dataset.mao!, alvo.getBoundingClientRect());
      }}
    >
      {celulas.map((c) => (
        <div
          key={c.mao}
          data-mao={c.mao}
          role="gridcell"
          aria-label={`${c.mao}${c.p > 0 ? `, ${Math.round(c.p)}% no range` : ", fora do range"}`}
          className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[4px] ${somenteLeitura ? "" : "cursor-pointer"}`}
          style={{
            background: c.fundo,
            outline: destacarMao === c.mao ? "2px solid #FFFFFF" : undefined,
            outlineOffset: destacarMao === c.mao ? 1 : undefined,
            zIndex: destacarMao === c.mao ? 1 : undefined,
          }}
        >
          {c.preenche && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: `${c.preenche.altura}%`, background: c.preenche.cor }} />
          )}
          <span
            className="pointer-events-none relative font-semibold leading-none tracking-tight"
            style={{ color: c.cor, fontSize: compacta ? "clamp(7px, 2.1vw, 10.5px)" : 11 }}
          >
            {c.mao}
          </span>
          {c.extra && (
            <span className="pointer-events-none relative mt-[2px] font-semibold leading-none" style={{ color: "rgba(0,0,0,0.65)", fontSize: compacta ? "clamp(6px, 1.7vw, 9px)" : 9 }}>
              {c.extra}%
            </span>
          )}
          {c.temCombo && modo.tipo === "range" && (
            <span className="pointer-events-none absolute right-[2px] top-[2px] h-[4px] w-[4px] rounded-full bg-white/80" title="Naipes escolhidos à mão" />
          )}
        </div>
      ))}
    </div>
  );
}
