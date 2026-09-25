"use client";

import { RANKS, cellBackground, getDecision, getHandLabel, type RangeHands } from "@/lib/poker/grade-gto";

// Range do GTO do spot que está sendo treinado -- grade 13x13 com a mão
// da rodada destacada. Aparece ao lado da mesa depois que o jogador
// responde: em vez de só "acertou/errou essa mão", ele vê o padrão
// inteiro do spot (onde a mão dele cai dentro do range). Antes de
// responder a grade fica desfocada, pra não entregar a resposta.
//
// Mesmas cores da biblioteca de ranges (cellBackground): fold cinza,
// call azul, raise verde, all-in vermelho -- a fatia de cada cor é a
// frequência daquela jogada na mão.

const F = '"Space Grotesk", sans-serif';

export function RangeDoSpot({
  hands,
  destaque,
  revelado,
  titulo,
  subtitulo,
  legenda,
}: {
  hands: RangeHands;
  /** Mão da rodada (ex.: "A9s") -- contorno branco na grade. */
  destaque: string | null;
  /** false = antes de responder: grade desfocada com aviso por cima. */
  revelado: boolean;
  titulo: string;
  subtitulo: string;
  legenda: { cor: string; rotulo: string }[];
}) {
  return (
    <aside
      className="ps-tr-range"
      style={{
        fontFamily: F,
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>{titulo}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{subtitulo}</div>
      </div>

      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(13, minmax(0, 1fr))",
            gap: 1.5,
            filter: revelado ? "none" : "blur(2px)",
            opacity: revelado ? 1 : 0.6,
            transition: "filter 260ms ease, opacity 260ms ease",
          }}
        >
          {RANKS.map((_, r) =>
            RANKS.map((__, c) => {
              const label = getHandLabel(r, c);
              const d = getDecision(hands, label);
              const ativa = revelado && destaque === label;
              return (
                // Antes de responder a grade vai NEUTRA (sem as cores de
                // verdade e sem a dica de frequência no mouse): só o
                // desfoque ainda deixava ver o formato do range e dava a
                // resposta de graça.
                <div
                  key={label}
                  title={revelado ? `${label} · fold ${d.fold}% · call ${d.call}% · raise ${d.raise}%` : undefined}
                  style={{
                    position: "relative",
                    aspectRatio: "1 / 1",
                    borderRadius: 2.5,
                    background: revelado ? cellBackground(d) : "rgba(255,255,255,0.07)",
                    outline: ativa ? "2px solid #FFFFFF" : "none",
                    outlineOffset: ativa ? 1 : 0,
                    boxShadow: ativa ? "0 0 12px rgba(255,255,255,0.8)" : "none",
                    zIndex: ativa ? 2 : 1,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 7.5,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.78)",
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                    overflow: "hidden",
                  }}
                >
                  {label}
                </div>
              );
            }),
          )}
        </div>
        {!revelado && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.8)",
              textShadow: "0 2px 12px rgba(0,0,0,0.9)",
              padding: 12,
            }}
          >
            Responda pra ver o range do GTO desse spot
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
        {legenda.map((l) => (
          <span key={l.rotulo} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "rgba(255,255,255,0.6)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: l.cor }} />
            {l.rotulo}
          </span>
        ))}
      </div>
      {revelado && destaque && (
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "rgba(255,255,255,0.5)" }}>
          A mão da rodada (<b style={{ color: "#FFFFFF" }}>{destaque}</b>) está contornada. Célula dividida = o GTO mistura as jogadas.
        </p>
      )}
    </aside>
  );
}
