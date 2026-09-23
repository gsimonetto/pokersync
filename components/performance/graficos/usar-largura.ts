"use client";

import { useEffect, useState, type RefObject } from "react";

// Largura real do elemento (px), acompanhando redimensionamento -- os
// gráficos desenham em px de verdade em vez de esticar um viewBox, pra
// linha não ficar grossa num lado e fina no outro.
export function useLargura(ref: RefObject<HTMLElement | null>): number {
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    setLargura(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [ref]);
  return largura;
}

// Largura e altura -- pro gráfico que estica até a altura do card vizinho.
// `ativo` refaz a medição quando o elemento medido aparece/some.
export function useTamanho(ref: RefObject<HTMLElement | null>, ativo = true): { largura: number; altura: number } {
  const [t, setT] = useState({ largura: 0, altura: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ler = (r: { width: number; height: number }) => setT({ largura: Math.round(r.width), altura: Math.round(r.height) });
    const ro = new ResizeObserver(([e]) => ler(e.contentRect));
    ro.observe(el);
    ler(el.getBoundingClientRect());
    return () => ro.disconnect();
  }, [ref, ativo]);
  return t;
}
