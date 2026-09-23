"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "framer-motion";

// Conta-giros (tacômetro de carro) do Score geral, pedido explícito:
// "o score como um contador de giros, igual de carro". Diferente do
// SpeedGauge do Marketplace (components/dashboard/kit.tsx), que é um
// velocímetro semicircular de duas cores: aqui o arco varre 240°, tem
// marcações numeradas de 0 a 10 (×10 pontos) e o ponteiro faz a
// "varredura" de quando o carro liga -- sobe até o fim da escala e
// volta até o valor.
//
// As faixas de cor são as MESMAS do card de Score da Performance
// (components/analysis/EvolutionScoreCard.tsx): abaixo de 40 fraco,
// 40-69 em evolução, 70+ bom.

const INICIO = 150; // graus (SVG: 0° = direita, sentido horário)
const VARREDURA = 240;
const W = 200;
const CX = W / 2;
const CY = 104;
const R = 84;

const FAIXAS = [
  { de: 0, ate: 40, cor: "#e0555a" },
  { de: 40, ate: 70, cor: "#f59e0b" },
  { de: 70, ate: 100, cor: "#22c55e" },
];

const angulo = (v: number) => INICIO + (Math.max(0, Math.min(100, v)) / 100) * VARREDURA;
// Arredonda em 2 casas: seno/cosseno dão a última casa decimal diferente
// no servidor e no navegador, e o React acusava "hydration mismatch" no
// desenho do arco. Centésimo de pixel é invisível.
const r2 = (n: number) => Math.round(n * 100) / 100;
function ponto(v: number, raio: number) {
  const a = (angulo(v) * Math.PI) / 180;
  return { x: r2(CX + raio * Math.cos(a)), y: r2(CY + raio * Math.sin(a)) };
}
function arco(de: number, ate: number, raio: number) {
  const p1 = ponto(de, raio);
  const p2 = ponto(ate, raio);
  const grande = ((ate - de) / 100) * VARREDURA > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${raio} ${raio} 0 ${grande} 1 ${p2.x} ${p2.y}`;
}

export function corDoScore(v: number): string {
  return v < 40 ? "#e0555a" : v < 70 ? "#f59e0b" : "#22c55e";
}

export function ContaGiros({ valor }: { valor: number | null }) {
  const reduzir = useReducedMotion();
  const alvo = valor ?? 0;
  const posicao = useMotionValue(reduzir ? alvo : 0);
  // O ponteiro é desenhado apontando pra cima (270° no SVG); girar
  // angulo(v) - 270 leva a ponta até o valor. Rotação pelo atributo
  // transform, com o cubo como centro -- em SVG é o jeito confiável.
  const [graus, setGraus] = useState(angulo(reduzir ? alvo : 0) - 270);
  useMotionValueEvent(posicao, "change", (v) => setGraus(angulo(v) - 270));

  useEffect(() => {
    if (reduzir) {
      posicao.set(alvo);
      return;
    }
    // Varredura de ignição: 0 -> 100 -> valor, com o ponteiro assentando
    // numa mola no final (como um ponteiro físico).
    const controle = animate(posicao, [posicao.get(), 100, alvo], {
      duration: 1.5,
      times: [0, 0.42, 1],
      ease: ["easeOut", [0.22, 1, 0.36, 1]],
      delay: 0.35,
    });
    return () => controle.stop();
  }, [alvo, reduzir, posicao]);

  const marcas = Array.from({ length: 21 }, (_, i) => i * 5);

  return (
    <svg viewBox={`0 0 ${W} 176`} className="h-auto w-full max-w-[220px]" role="img" aria-label={`Score geral ${valor ?? "sem dado"} de 100`}>
      {/* trilho */}
      <path d={arco(0, 100, R)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} strokeLinecap="round" />
      {/* faixas de qualidade (fracas, por baixo) */}
      {FAIXAS.map((f) => (
        <path key={f.de} d={arco(f.de, f.ate, R + 9)} fill="none" stroke={f.cor} strokeOpacity={0.55} strokeWidth={2.5} />
      ))}
      {/* trecho percorrido, na cor da faixa do valor */}
      {valor != null && (
        <motion.path
          d={arco(0, Math.max(0.5, valor), R)}
          fill="none"
          stroke={corDoScore(valor)}
          strokeWidth={12}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.9 }}
        />
      )}
      {/* marcações: maiores a cada 10, com número (0-10, ×10 pontos) */}
      {marcas.map((m) => {
        const maior = m % 10 === 0;
        const a = ponto(m, R - 10);
        const b = ponto(m, R - (maior ? 19 : 14));
        const t = ponto(m, R - 30);
        return (
          <g key={m}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={maior ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)"}
              strokeWidth={maior ? 2 : 1.2}
              strokeLinecap="round"
            />
            {maior && (
              <text
                x={t.x}
                y={t.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="painel-numero"
                fill="rgba(255,255,255,0.5)"
                fontSize={10}
                fontWeight={500}
              >
                {m / 10}
              </text>
            )}
          </g>
        );
      })}
      <text x={CX} y={CY - 26} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={8} letterSpacing={1}>
        ×10
      </text>
      {/* ponteiro afinado + cubo */}
      <g transform={`rotate(${graus} ${CX} ${CY})`}>
        <path d={`M ${CX - 3.2} ${CY} L ${CX} ${CY - R + 8} L ${CX + 3.2} ${CY} Z`} fill="#f25c3c" />
        <line x1={CX} y1={CY} x2={CX} y2={CY + 12} stroke="#f25c3c" strokeWidth={3} strokeLinecap="round" />
      </g>
      <circle cx={CX} cy={CY} r={7} fill="#1a1a1a" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      <circle cx={CX} cy={CY} r={2.2} fill="#f25c3c" />
    </svg>
  );
}
