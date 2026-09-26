// ============================================================
// Gravuras de segurança -- os desenhos finos de cédula/certificado que
// dão às cartas (Membro Fundador, ficha do ranking) o acabamento de
// peça impressa: rosácea de guilhochê, ondas, micro-texto e cantos
// art déco. Tudo gerado por fórmula (sem imagem) e sempre igual entre
// servidor e cliente.
// ============================================================

/** Rosácea de guilhochê: curvas de espirógrafo sobrepostas, levemente defasadas. */
export function rosacea(cx: number, cy: number, { raio = 70, aneis = 9, passo = 3.2, amplitude = 16, petalas = 18 } = {}): string[] {
  const linhas: string[] = [];
  for (let s = 0; s < aneis; s++) {
    const a = raio + s * passo;
    const b = amplitude - s * (amplitude / 26);
    const pts: string[] = [];
    for (let i = 0; i <= 720; i++) {
      const t = (i / 720) * Math.PI * 2;
      const x = cx + a * Math.cos(t) + b * Math.cos(petalas * t + s * 0.35);
      const y = cy + a * Math.sin(t) - b * Math.sin(petalas * t + s * 0.35);
      pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    linhas.push(`M${pts.join(" L")} Z`);
  }
  return linhas;
}

/** Faixa de linhas onduladas (mesma família do guilhochê). */
export function ondas(x0: number, x1: number, y: number, linhas = 7): string[] {
  return Array.from({ length: linhas }, (_, k) => {
    const pts: string[] = [];
    for (let x = x0; x <= x1; x += 4) pts.push(`${x} ${(y + k * 3 + 2.4 * Math.sin(x / 9 + k * 0.9)).toFixed(1)}`);
    return `M${pts.join(" L")}`;
  });
}

/** Canto art déco no quadro 0..48 (canto de cima-esquerda; os outros são espelho). */
export const CANTO_DECO = "M14 46 V20 Q14 14 20 14 H46 M20 38 V24 Q20 20 24 20 H38 M26 26 L32 32";

/** Os quatro cantos, posicionados por CSS -- funciona em carta de qualquer altura. */
export function CantosDeco({ cor, tamanho = 48 }: { cor: string; tamanho?: number }) {
  const lados = [
    { style: { left: 0, top: 0 }, t: undefined },
    { style: { right: 0, top: 0 }, t: "translate(48 0) scale(-1 1)" },
    { style: { left: 0, bottom: 0 }, t: "translate(0 48) scale(1 -1)" },
    { style: { right: 0, bottom: 0 }, t: "translate(48 48) scale(-1 -1)" },
  ];
  return (
    <>
      {lados.map((l, i) => (
        <svg key={i} viewBox="0 0 48 48" width={tamanho} height={tamanho} className="pointer-events-none absolute" style={l.style} aria-hidden>
          <path d={CANTO_DECO} transform={l.t} fill="none" stroke={cor} strokeWidth="1" strokeLinecap="round" />
        </svg>
      ))}
    </>
  );
}

/** Linha de micro-texto (legível só de perto, como em cédula). */
export function MicroTexto({ texto, cor, className = "" }: { texto: string; cor: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute overflow-hidden whitespace-nowrap text-[4.5px] leading-none tracking-[0.12em] ${className}`}
      style={{ color: cor, fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      {texto.repeat(20)}
    </span>
  );
}
