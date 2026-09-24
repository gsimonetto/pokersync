"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Wallet } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { fmtMoneyIn } from "@/lib/bankroll/format";
import { Chip } from "@/components/chip";
import { EASE, Numero, Selo, TileIcone } from "./painel-card";
import { InfoHover, type Explicacao } from "./info-hover";
import { usePainelDados } from "./painel-dados";
import { dataCurta, num } from "./formato";

function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// No computador o cabeçalho precisa ser BAIXO: a tela inteira cabe na
// janela sem rolagem, então cada pixel gasto aqui sai do espaço dos
// cards. Hierarquia: a Banca total é a informação que importa, então ela
// tem o maior peso; o relógio é apoio e fica menor e mais apagado.
export function PainelHeader() {
  const { perfil, progresso, bancaAtual, resultado30d, moedaBanca, bancaConvertida } = usePainelDados();
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
  const [agora, setAgora] = useState<Date | null>(null);

  // Relógio: a data só existe depois de montar no cliente (o servidor
  // roda em outro fuso e daria erro de hidratação). Como só mostramos hora
  // e minuto, atualiza na virada de cada minuto, não a cada segundo.
  useEffect(() => {
    setAgora(new Date());
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const ateVirada = 60_000 - (Date.now() % 60_000);
    const primeiro = setTimeout(() => {
      setAgora(new Date());
      intervalo = setInterval(() => setAgora(new Date()), 60_000);
    }, ateVirada);
    return () => {
      clearTimeout(primeiro);
      if (intervalo) clearInterval(intervalo);
    };
  }, []);

  const nome = perfil?.apelido?.trim() || perfil?.nome?.trim() || "jogador";
  const streak = progresso?.streak_days ?? null;
  const corResultado =
    resultado30d == null || resultado30d === 0 ? "#c4c7c8" : resultado30d > 0 ? "#22c55e" : "#e0555a";

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
          <span className="text-muted">{agora ? saudacao(agora.getHours()) : "Olá"},</span>{" "}
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

      <div className="flex items-center gap-4 lg:shrink-0">
        {/* No celular o relógio sai: o próprio aparelho já mostra a hora,
            e sem ele a banca cabe inteira na largura da tela. */}
        <div className="hidden text-right sm:block">
          {/* 24h, sem AM/PM: formato usado no Brasil. */}
          {/* A cada minuto o horário novo desce no lugar do antigo. */}
          <p className="tnum relative overflow-hidden text-2xl font-light leading-none text-ink/80 sm:text-[28px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={agora ? `${agora.getHours()}:${agora.getMinutes()}` : "-"}
                className="block"
                initial={{ y: "-60%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "60%", opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                {agora
                  ? `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`
                  : "--:--"}
              </motion.span>
            </AnimatePresence>
          </p>
          <p className="mt-1 text-[11px] text-muted/80">{agora ? dataCurta(agora) : ""}</p>
        </div>

        <InfoHover explicacao={explicacaoBanca} className="min-w-0 flex-1 sm:flex-none">
          <div className="painel-vidro flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 px-4 py-2.5">
            <TileIcone cor="#d4af37" grande>
              <Wallet size={17} />
            </TileIcone>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted/80">Banca total</p>
              <p className="tnum text-xl font-semibold leading-tight">
                {bancaAtual == null ? "—" : <Numero valor={bancaAtual} formatar={formatarBanca} duracao={1100} />}
              </p>
            </div>
            {resultado30d != null && (
              <div className="shrink-0 border-l border-hairline pl-3">
                <Selo cor={corResultado}>
                  {resultado30d > 0 ? "+" : ""}
                  <Numero valor={resultado30d} formatar={formatarBanca} duracao={1100} />
                </Selo>
                <p className="mt-1 text-[11px] text-muted/80">30 dias</p>
              </div>
            )}
          </div>
        </InfoHover>
      </div>
    </header>
  );
}
