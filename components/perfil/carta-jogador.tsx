"use client";

import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Avatar } from "@/components/avatar";
import { EmblemaPatente, MATERIAIS, faixaDoNivel } from "@/components/hub/patentes/emblema";
import { SeloFundador } from "@/components/achievements/selo-fundador";
import { levelMaterial, levelSubTier } from "@/lib/services/xp-service";

// Carta do jogador (pedido explícito: "a primeira [sugestão], pode tirar
// os troféus e o compartilhar, apenas a carta, alinhe os números e deixe
// bem top"). Estilo carta colecionável: a moldura é do material da
// patente (bronze -> lendário), o nível grande no canto, a foto, o nome e
// seis atributos de poker em duas colunas alinhadas.
//
// Mexe junto com o mouse (inclinação + brilho do metal); quem pediu menos
// movimento no sistema vê a carta parada.

export interface AtributoCarta {
  sigla: string;
  /** Texto já formatado; null = ainda sem dado ("—"). */
  valor: string | null;
  /** O que a sigla quer dizer (aparece ao passar o mouse). */
  nome: string;
}

// Formato da carta: cantos de cima chanfrados e a base em ponta suave.
const FORMA = "polygon(9% 0, 91% 0, 100% 5.5%, 100% 91%, 50% 100%, 0 91%, 0 5.5%)";
const LARGURA = 340;
const ALTURA = 540;

export function CartaJogador({
  nome,
  subtitulo,
  nivel,
  avatarId,
  avatarUrl,
  fundador,
  atributos,
  rodape,
}: {
  /** Nome grande da carta (apelido ou sobrenome). */
  nome: string;
  subtitulo?: string | null;
  nivel: number;
  avatarId: number;
  avatarUrl?: string | null;
  fundador?: boolean;
  /** Seis atributos: os três primeiros na coluna da esquerda. */
  atributos: AtributoCarta[];
  rodape?: string | null;
}) {
  const m = MATERIAIS[faixaDoNivel(nivel)];
  const reduzir = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [giro, setGiro] = useState({ x: 0, y: 0, ativo: false });

  function mover(e: React.PointerEvent) {
    if (reduzir || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setGiro({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5, ativo: true });
  }

  const esquerda = atributos.slice(0, 3);
  const direita = atributos.slice(3, 6);

  return (
    <div style={{ perspective: 1100 }}>
      <div
        ref={ref}
        onPointerMove={mover}
        onPointerLeave={() => setGiro({ x: 0, y: 0, ativo: false })}
        style={{
          width: LARGURA,
          height: ALTURA,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateY(${giro.x * 14}deg) rotateX(${-giro.y * 14}deg)`,
          transition: giro.ativo ? "transform 60ms linear" : "transform 500ms cubic-bezier(.22,1,.36,1)",
          filter: `drop-shadow(0 30px 50px ${m.base}38) drop-shadow(0 10px 18px rgba(0,0,0,.7))`,
        }}
      >
        {/* Moldura de metal (a borda é o espaço entre as duas formas). */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: FORMA,
            background: `linear-gradient(155deg, ${m.claro} 0%, ${m.base} 22%, ${m.escuro} 48%, ${m.base} 70%, ${m.claro} 86%, ${m.escuro} 100%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 3,
            clipPath: FORMA,
            background: `radial-gradient(130% 75% at 50% 0%, ${m.base}55 0%, ${m.escuro}cc 45%, #07070a 80%)`,
            overflow: "hidden",
          }}
        >
          {/* Textura: linhas finas na diagonal, como gravação no metal. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.09,
              background: `repeating-linear-gradient(135deg, ${m.claro} 0 1px, transparent 1px 9px)`,
            }}
          />
          {/* Filete interno, acompanhando a forma da carta. */}
          <div aria-hidden style={{ position: "absolute", inset: 9, clipPath: FORMA, boxShadow: `inset 0 0 0 1px ${m.claro}33` }} />
          {/* Brilho que corre com o mouse. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              mixBlendMode: "screen",
              opacity: giro.ativo ? 0.55 : 0.25,
              transition: "opacity 300ms",
              background: `linear-gradient(${115 + giro.x * 40}deg, transparent 30%, ${m.claro}55 ${48 + giro.y * 20}%, transparent 66%)`,
            }}
          />

          {/* Topo: nível e patente à esquerda, foto à direita. */}
          <div style={{ position: "absolute", top: 34, left: 30, width: 78, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span className="tnum" style={{ fontSize: 58, fontWeight: 800, lineHeight: 0.9, color: m.claro, textShadow: `0 2px 0 ${m.escuro}, 0 0 24px ${m.base}66`, letterSpacing: "-0.04em" }}>
              {nivel}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: m.claro, textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {levelMaterial(nivel)} {levelSubTier(nivel)}
            </span>
            <span style={{ width: 34, height: 1, background: `${m.claro}55`, margin: "2px 0" }} />
            <EmblemaPatente nivel={nivel} tamanho={46} animar={false} halo={false} mostrarNumero={false} />
            {fundador && (
              <span title="Membro Fundador">
                <SeloFundador tamanho={34} animar={false} />
              </span>
            )}
          </div>
          <div style={{ position: "absolute", top: 40, right: 30, width: 176, height: 176, display: "grid", placeItems: "center" }}>
            <div aria-hidden style={{ position: "absolute", inset: -10, borderRadius: 999, background: `radial-gradient(circle, ${m.base}55, transparent 68%)` }} />
            <div style={{ position: "relative", borderRadius: 26, padding: 2, background: `linear-gradient(160deg, ${m.claro}, ${m.escuro})` }}>
              <div style={{ borderRadius: 24, background: "#0b0b0d" }}>
                <Avatar id={avatarId} url={avatarUrl} size={168} shape="square" />
              </div>
            </div>
          </div>

          {/* Nome. */}
          <div style={{ position: "absolute", top: 236, left: 26, right: 26, textAlign: "center" }}>
            <p
              style={{
                margin: 0,
                fontSize: nome.length > 14 ? 22 : 27,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {nome}
            </p>
            {subtitulo && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "rgba(255,255,255,.55)", letterSpacing: "0.04em" }}>{subtitulo}</p>}
            <div style={{ height: 1, margin: "12px auto 0", width: "86%", background: `linear-gradient(90deg, transparent, ${m.claro}aa, transparent)` }} />
          </div>

          {/* Atributos: duas colunas, valor alinhado à direita e sigla à esquerda. */}
          <div style={{ position: "absolute", top: 324, left: 26, right: 26, display: "grid", gridTemplateColumns: "1fr 1px 1fr", columnGap: 14 }}>
            <Coluna itens={esquerda} cor={m.claro} />
            <span aria-hidden style={{ background: `linear-gradient(180deg, transparent, ${m.claro}66, transparent)` }} />
            <Coluna itens={direita} cor={m.claro} />
          </div>

          {/* Rodapé: ranking e a marca. */}
          <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <div style={{ height: 1, width: "62%", background: `linear-gradient(90deg, transparent, ${m.claro}66, transparent)` }} />
            {rodape && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: m.claro }}>{rodape}</span>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pokersync-logo.svg" alt="PokerSync" style={{ height: 18, opacity: 0.85 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Coluna({ itens, cor }: { itens: AtributoCarta[]; cor: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {itens.map((a) => (
        <div key={a.sigla} title={a.nome} style={{ display: "grid", gridTemplateColumns: "80px 1fr", alignItems: "center", columnGap: 9, lineHeight: 1 }}>
          <span className="tnum" style={{ textAlign: "right", fontSize: 21, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            {a.valor ?? "—"}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.1em", color: cor }}>{a.sigla}</span>
        </div>
      ))}
    </div>
  );
}
