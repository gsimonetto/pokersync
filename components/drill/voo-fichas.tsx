"use client";

import { useLayoutEffect, useRef } from "react";
import { F, num } from "@/lib/poker/drill-theme";
import { FichaAmericana, type Denominacao } from "./ficha-americana";

/* Fichas voando pela mesa na animação "Moeda girando" (escolha explícita
   entre as 8 animações desenhadas): cada ficha gira como uma moeda
   jogada, num arco curto, e as fichas saem uma atrás da outra.

   - aposta:   do assento até a pilha da aposta na frente dele;
   - devolucao: a parte da aposta que ninguém pagou volta da pilha pro
                stack do dono;
   - recolher: das apostas da rua até o pote (o pote acende em dourado);
   - premio:   as fichas se espalham pra fora do pote e vão até o vencedor.

   As posições chegam em pixel, relativas à caixa da mesa (quem chama mede
   onde estão o assento, a aposta e o pote). */

export interface Ponto {
  x: number;
  y: number;
}

export interface Voo {
  id: string;
  tipo: "aposta" | "devolucao" | "recolher" | "premio";
  fichas: Denominacao[];
  de: Ponto;
  para: Ponto;
  atrasoMs?: number;
  /** Texto que aparece quando as fichas chegam (ex.: "+12,5 BB" ao lado do stack do vencedor). */
  rotulo?: { texto: string; em: Ponto; lado: "direita" | "esquerda" };
}

// Tempos da animação em velocidade normal (ms). `entre` = espera entre
// uma ficha e a próxima.
const TEMPO = {
  aposta: { dur: 620, entre: 80 },
  devolucao: { dur: 560, entre: 60 },
  recolher: { dur: 560, entre: 35 },
  premio: { dur: 620, entre: 55 },
};
const ESPALHAR_MS = 260;
const ROTULO_MS = 1400;
const CURVA = "cubic-bezier(.3,.7,.3,1)";

/** Quanto tempo o voo leva do começo até a última ficha chegar (ms, já na velocidade escolhida). */
export function duracaoDoVoo(tipo: Voo["tipo"], quantasFichas: number, vel: number, atrasoMs = 0): number {
  const t = TEMPO[tipo];
  const espalhar = tipo === "premio" ? ESPALHAR_MS : 0;
  return (atrasoMs + espalhar + t.dur + Math.max(0, quantasFichas - 1) * t.entre) * vel;
}

// Moeda girando: a ficha "fecha" (scaleX perto de 0, vista de lado) duas
// vezes no caminho, subindo num arco baixo. (x0, y0) = de onde a ficha
// parte, relativo ao ponto de origem do elemento.
function quadrosMoeda(x0: number, y0: number, dx: number, dy: number, arco: number): Keyframe[] {
  const q = (k: number, sobe: number, giro: number, opacidade: number, offset?: number): Keyframe => ({
    transform: `translate(-50%, -50%) translate(${x0 + dx * k}px, ${y0 + dy * k - sobe}px) scaleX(${giro})`,
    opacity: opacidade,
    ...(offset != null ? { offset } : {}),
  });
  return [q(0, 0, 1, 1), q(0.25, arco * 0.7, 0.15, 1, 0.25), q(0.5, arco, 1, 1, 0.5), q(0.75, arco * 0.55, 0.15, 1, 0.75), q(1, 0, 1, 1)];
}

export function VooDeFichas({ voo, tamanho, vel, onFim }: { voo: Voo; tamanho: number; vel: number; onFim: (id: string) => void }) {
  const fichasRef = useRef<(HTMLDivElement | null)[]>([]);
  const rotuloRef = useRef<HTMLDivElement>(null);
  // Tamanho, velocidade e aviso de fim lidos na hora: mudar a mesa de
  // tamanho no meio do voo não recomeça a animação.
  const atual = useRef({ tamanho, vel, onFim });
  atual.current = { tamanho, vel, onFim };

  useLayoutEffect(() => {
    const { tamanho: tam, vel: v } = atual.current;
    const animacoes: Animation[] = [];
    let ativo = true;
    const anima = (el: Element, quadros: Keyframe[], duracao: number, atraso: number) => {
      const a = el.animate(quadros, { duration: duracao * v, delay: atraso * v, easing: CURVA, fill: "both" });
      animacoes.push(a);
      return a.finished;
    };
    const t = TEMPO[voo.tipo];
    const atraso = voo.atrasoMs ?? 0;
    const dx = voo.para.x - voo.de.x;
    const dy = voo.para.y - voo.de.y;
    const arco = tam * 1.1;

    const voos = voo.fichas.map(async (_, i) => {
      const el = fichasRef.current[i];
      if (!el) return;
      if (voo.tipo === "premio") {
        // Explode pra fora do pote antes de ir até o vencedor.
        const angulo = (i / voo.fichas.length) * Math.PI * 2 - Math.PI / 2;
        const ex = Math.cos(angulo) * tam * 2.2;
        const ey = Math.sin(angulo) * tam * 1.4;
        await anima(
          el,
          [
            { transform: "translate(-50%, -50%) scale(.6)", opacity: 0 },
            { transform: `translate(-50%, -50%) translate(${ex}px, ${ey}px) scale(1)`, opacity: 1 },
          ],
          ESPALHAR_MS,
          atraso + i * 20,
        );
        if (!ativo) return;
        await anima(el, quadrosMoeda(ex, ey, dx - ex, dy - ey, arco), t.dur, i * t.entre);
      } else {
        await anima(el, quadrosMoeda(0, 0, dx, dy, arco), t.dur, atraso + i * t.entre);
      }
      // Chegou: some dentro da pilha / da placa de destino.
      if (ativo) el.style.visibility = "hidden";
    });

    Promise.all(voos)
      .then(async () => {
        if (!ativo) return;
        const rotulo = rotuloRef.current;
        if (rotulo) {
          // Encosta ao lado do stack do vencedor, fica parado um instante
          // pra dar tempo de ler e some subindo.
          const x = voo.rotulo?.lado === "esquerda" ? "-100%" : "0%";
          const sobe = (px: number) => `translate(${x}, -50%) translateY(${-px}px)`;
          await anima(
            rotulo,
            [
              { transform: sobe(-6), opacity: 0 },
              { transform: sobe(0), opacity: 1, offset: 0.18 },
              { transform: sobe(0), opacity: 1, offset: 0.75 },
              { transform: sobe(tam * 0.8), opacity: 0 },
            ],
            ROTULO_MS,
            0,
          );
        }
        if (ativo) atual.current.onFim(voo.id);
      })
      // Animação cancelada (a mesa saiu da tela) -- nada a fazer.
      .catch(() => {});

    return () => {
      ativo = false;
      animacoes.forEach((a) => a.cancel());
    };
  }, [voo]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }} aria-hidden="true">
      {voo.fichas.map((d, i) => (
        <div
          key={i}
          ref={(el) => {
            fichasRef.current[i] = el;
          }}
          style={{
            position: "absolute",
            left: voo.de.x,
            top: voo.de.y,
            // Parado na origem até a vez dele (o "fill" da animação assume daqui).
            transform: "translate(-50%, -50%)",
            opacity: 0,
            filter: "drop-shadow(0 3px 3px rgba(0,0,0,.55))",
            willChange: "transform",
          }}
        >
          <FichaAmericana d={d} tamanho={tamanho} />
        </div>
      ))}
      {voo.rotulo && (
        <div
          ref={rotuloRef}
          style={{
            position: "absolute",
            left: voo.rotulo.em.x,
            top: voo.rotulo.em.y,
            opacity: 0,
            fontFamily: F,
            fontSize: Math.max(11, tamanho * 0.95),
            fontWeight: 700,
            color: "#FCD34D",
            textShadow: "0 1px 3px rgba(0,0,0,.9)",
            whiteSpace: "nowrap",
            ...num,
          }}
        >
          {voo.rotulo.texto}
        </div>
      )}
    </div>
  );
}
