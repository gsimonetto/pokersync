"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Flame, Wallet } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { fmtMoneyIn } from "@/lib/bankroll/format";
import { Chip } from "@/components/chip";
import { ResumoNivel } from "@/components/hub/resumo-nivel";
import { Numero, TileIcone } from "./painel-card";
import { InfoHover, type Explicacao } from "./info-hover";
import { usePainelDados } from "./painel-dados";
import { num } from "./formato";

// Valor da Banca escondido ou não (o olho ao lado dela). Fica guardado no
// aparelho: quem abre o app em público não precisa esconder toda vez.
const CHAVE_OCULTAR = "pokersync:inicio:ocultar-banca";

function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// No computador o cabeçalho precisa ser BAIXO: a tela inteira cabe na
// janela sem rolagem, então cada pixel gasto aqui sai do espaço dos
// cards. À direita: o seu nível (foto, patente e quanto falta) e a Banca
// total, com um olho pra esconder o valor. O relógio e o resultado de 30
// dias saíram (pedido explícito).
export function PainelHeader() {
  const { perfil, progresso, bancaAtual, moedaBanca, bancaConvertida } = usePainelDados();
  const formatarBanca = (v: number) => (moedaBanca === "BRL" ? formatBRL(v) : fmtMoneyIn(v, moedaBanca));
  // Saldo em outra moeda entra convertido; ao passar o mouse o jogador vê
  // de onde veio cada parte (ex.: "US$ 305,00 × 5,32").
  const explicacaoBanca: Explicacao = {
    titulo: "Banca total",
    oQueE: "Quanto você tem pra jogar agora: banca inicial + resultado das sessões + depósitos − saques − caixinha.",
    origem: "Gestão de Banca",
    comoCalcula:
      bancaConvertida.length > 0
        ? "Saldos em outra moeda entram convertidos pra reais (dólar pela cotação do dia)."
        : moedaBanca !== "BRL"
          ? `Mostrado em ${moedaBanca}: a cotação pra converter não carregou agora.`
          : undefined,
    itens: bancaConvertida.length > 0
      ? bancaConvertida.map((c) => ({
          rotulo: `${fmtMoneyIn(c.saldo, c.moeda)} × ${c.taxa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`,
          valor: formatBRL(c.saldo * c.taxa),
        }))
      : undefined,
  };
  // Saudação pela hora de quem está vendo -- só depois de montar no
  // cliente (o servidor roda em outro fuso e daria erro de hidratação).
  const [hora, setHora] = useState<number | null>(null);
  useEffect(() => setHora(new Date().getHours()), []);

  const [oculta, setOculta] = useState(false);
  useEffect(() => {
    try {
      setOculta(window.localStorage.getItem(CHAVE_OCULTAR) === "1");
    } catch {
      // modo privado: começa mostrando
    }
  }, []);
  const alternarOculta = () => {
    setOculta((v) => {
      try {
        window.localStorage.setItem(CHAVE_OCULTAR, v ? "0" : "1");
      } catch {
        // sem localStorage: vale só nesta visita
      }
      return !v;
    });
  };

  const nome = perfil?.apelido?.trim() || perfil?.nome?.trim() || "jogador";
  const streak = progresso?.streak_days ?? null;

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
          <span className="text-muted">{hora != null ? saudacao(hora) : "Olá"},</span>{" "}
          <span className="painel-ouro">{nome}</span>
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <p className="text-[12px] text-muted/80">Estude · Jogue · Revise · Evolua</p>
          {streak != null && streak > 0 && (
            // Mesmo Chip padrão (brilho na cor) dos outros módulos.
            <Chip color="#f59e0b">
              <Flame size={11} />
              {num(streak)} {streak === 1 ? "dia seguido" : "dias seguidos"}
            </Chip>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center lg:shrink-0">
        {progresso && <ResumoNivel progress={progresso} perfil={perfil} />}

        {/* Escondida, a explicação do mouse também não mostra os saldos. */}
        <InfoHover explicacao={oculta ? { ...explicacaoBanca, itens: undefined } : explicacaoBanca} className="min-w-0 sm:flex-none">
          <div className="painel-vidro flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 px-4 py-2.5">
            <TileIcone cor="#d4af37" grande>
              <Wallet size={17} />
            </TileIcone>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted/80">Banca total</p>
              <p className="tnum text-xl font-semibold leading-tight">
                {bancaAtual == null ? (
                  "—"
                ) : oculta ? (
                  <span aria-label="Valor escondido" className="tracking-[0.18em] text-ink/70">
                    ••••••
                  </span>
                ) : (
                  <Numero valor={bancaAtual} formatar={formatarBanca} duracao={1100} />
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                alternarOculta();
              }}
              aria-pressed={oculta}
              aria-label={oculta ? "Mostrar o valor da banca" : "Esconder o valor da banca"}
              title={oculta ? "Mostrar o valor" : "Esconder o valor"}
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-muted transition hover:border-white/20 hover:text-ink"
            >
              {oculta ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </InfoHover>
      </div>
    </header>
  );
}
