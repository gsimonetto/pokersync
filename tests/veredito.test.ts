import { describe, expect, it } from "vitest";
import { classificarJogada, ehAcerto, nomeDoVeredito } from "@/lib/poker/gto-verdict";

describe("veredito no modelo do GTO Wizard", () => {
  it("a jogada que o GTO mais faz é a melhor", () => {
    expect(classificarJogada(1, 3)).toBe("OTIMA");
    expect(classificarJogada(0.5, 0)).toBe("OTIMA");
  });
  it("a parte menor de uma mistura é correta (acerto)", () => {
    expect(classificarJogada(0.3, 0.02)).toBe("ACEITAVEL");
    expect(classificarJogada(0.035, 0.02)).toBe("ACEITAVEL");
    expect(ehAcerto("ACEITAVEL")).toBe(true);
  });
  it("fora do GTO: o tamanho da perda decide", () => {
    expect(classificarJogada(0.02, 0.05)).toBe("ERRO_LEVE");
    expect(nomeDoVeredito("ERRO_LEVE", 0.05)).toBe("Imprecisão");
    expect(classificarJogada(0, 0.4)).toBe("ERRO_GRAVE");
    expect(nomeDoVeredito("ERRO_GRAVE", 0.4)).toBe("Erro");
    expect(nomeDoVeredito("ERRO_GRAVE", 2.5)).toBe("Erro grave");
    expect(ehAcerto("ERRO_LEVE")).toBe(false);
  });
  it("sem régua de bb, fora do GTO é erro", () => {
    expect(classificarJogada(0, null)).toBe("ERRO_GRAVE");
    expect(nomeDoVeredito("ERRO_GRAVE", null)).toBe("Erro grave");
  });
});
