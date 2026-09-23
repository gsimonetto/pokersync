"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Chip } from "@/components/chip";

// Curva de saída "com peso" (rápida no começo, assentando no fim) usada em
// todas as animações do Painel -- uma só, pra tela inteira se mover com o
// mesmo ritmo em vez de cada card ter o seu.
export const EASE = [0.22, 1, 0.36, 1] as const;

// Casca visual de todo card do Painel: preto (bg-surface), borda fina,
// um fio de luz no topo e o MESMO facho da tela de login — brilho branco
// que segue o mouse e some quando ele sai (ver "Spotlight do Mouse" em
// app/login/login-form.tsx: círculo de 400px, branco a 6%).
export function PainelCard({
  title,
  icon,
  action,
  children,
  className = "",
  style,
  ordem = 0,
  rolagem = true,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Posição na entrada em sequência (0 = primeiro card a aparecer). */
  ordem?: number;
  /** false = o card nunca ganha barra de rolagem (ex.: Calendário, que
   *  foi desenhado pra caber inteiro). */
  rolagem?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  return (
    // Entrada em sequência: cada card sobe um pouco e assenta, um depois
    // do outro (70ms de intervalo), na ordem de leitura da tela.
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.05 + ordem * 0.07 }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      className={`painel-vidro group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 p-4 sm:p-5 xl:p-4 ${className}`}
      style={style}
    >
      {/* -inset-px cobre a borda também, senão o brilho para 1px antes
          dela e o recorte fica visível no canto. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(400px circle at ${mouse.x}px ${mouse.y}px, rgba(255, 255, 255, 0.06), transparent 40%)`,
        }}
      />
      {/* Fio de luz no topo: separa o card do fundo preto sem precisar de
          borda mais forte, que engrossaria a tela toda. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      <header className="relative flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          {icon && (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-muted">
              {icon}
            </span>
          )}
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </header>
      {/* As listas mostram no máximo 3 itens antes de rolar (ListaLimitada),
          então o corpo do card normalmente cabe sem barra. A rolagem do
          corpo fica só como rede de segurança pra janela muito baixa --
          e some de vez nos cards com rolagem={false}. */}
      <div
        className={`painel-scroll relative mt-4 flex min-h-0 flex-1 flex-col overflow-x-hidden xl:mt-3 ${
          rolagem ? "overflow-y-auto" : "overflow-y-hidden"
        }`}
      >
        {children}
      </div>
    </motion.section>
  );
}

// Quadradinho de ícone — o detalhe que dá acabamento às listas (cada
// item ganha identidade visual sem precisar de texto extra). O fundo é
// neutro (vidro claro) e só o traço do ícone leva a cor do módulo: com
// fundo colorido em todo item a tela virava um arco-íris de quadrados, e
// a cor deixava de chamar atenção onde importa (valores e alertas).
export function TileIcone({ children, cor, grande = false }: { children: ReactNode; cor: string; grande?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl ${grande ? "h-10 w-10" : "h-8 w-8"}`}
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        color: cor,
        boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
      }}
    >
      {children}
    </span>
  );
}

// Selo pequeno (prioridade, situação da meta, resultado) — é o Chip
// padrão do produto (components/chip.tsx: borda, fundo translúcido e
// brilho na cor), o mesmo dos Módulos, do Time e do Marketplace. Antes o
// Painel tinha um selo próprio, chapado e sem brilho, e destoava do resto.
// A cor precisa ser hex de 6 dígitos (o Chip soma a transparência nela).
export function Selo({ children, cor, pequeno = false }: { children: ReactNode; cor: string; pequeno?: boolean }) {
  return (
    <Chip color={cor} size={pequeno ? "sm" : "md"} className="shrink-0">
      {children}
    </Chip>
  );
}

// Bloco interno de lista: dá ao item o mesmo tratamento de card pequeno
// (fundo próprio, canto arredondado, realce no hover) em vez de deixar o
// texto solto sobre o fundo do card.
export function Linha({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`painel-bloco rounded-2xl border border-white/5 p-3 transition hover:border-white/15 active:scale-[0.99] ${className}`}
    >
      {children}
    </div>
  );
}

// Blocos de carregamento no formato do conteúdo (em vez do texto
// "Carregando…"): o card já nasce com a altura certa e a tela não pula
// quando os dados chegam. `linhas` = quantos blocos; `altura` = de cada um.
export function Esqueleto({ linhas = 3, altura = 44 }: { linhas?: number; altura?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="painel-esqueleto rounded-2xl" style={{ height: altura }} />
      ))}
    </div>
  );
}

// Estado vazio padronizado — sem isto cada card inventava a
// própria frase e o grid ficava desalinhado no primeiro carregamento.
export function CardHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

// Lista que mostra no máximo `visiveis` itens (padrão 3) e só a partir
// daí ganha barra de rolagem -- pedido explícito: nada de barra em card
// com pouca coisa. A altura é MEDIDA (fim do 3º item), não chutada, então
// funciona com itens de alturas diferentes. Quando rola, a borda de baixo
// esmaece pra avisar que tem mais conteúdo.
export function ListaLimitada({
  children,
  visiveis = 3,
  className = "",
}: {
  children: ReactNode;
  visiveis?: number;
  className?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [altura, setAltura] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const ul = ref.current;
    if (!ul) return;
    const medir = () => {
      const itens = ul.children;
      if (itens.length <= visiveis) {
        setAltura(undefined);
        return;
      }
      const ultimo = itens[visiveis - 1] as HTMLElement;
      setAltura(ultimo.offsetTop + ultimo.offsetHeight);
    };
    medir();
    const ro = new ResizeObserver(medir);
    for (const filho of Array.from(ul.children)) ro.observe(filho);
    return () => ro.disconnect();
  }, [children, visiveis]);

  const rola = altura != null;
  return (
    <ul
      ref={ref}
      className={`painel-scroll relative flex flex-col gap-2 ${rola ? "overflow-y-auto pr-1" : ""} ${className}`}
      style={
        rola
          ? {
              maxHeight: altura,
              WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 18px), transparent)",
              maskImage: "linear-gradient(to bottom, #000 calc(100% - 18px), transparent)",
            }
          : undefined
      }
    >
      {children}
    </ul>
  );
}

// Item de lista que entra em sequência (um pouco depois do card).
export function ItemAnimado({
  children,
  indice,
  className = "",
}: {
  children: ReactNode;
  indice: number;
  className?: string;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.35 + indice * 0.06 }}
      className={className}
    >
      {children}
    </motion.li>
  );
}

// Número que conta do valor anterior até o novo (0 na primeira vez) --
// dá leitura de "dado vivo" sem efeito gratuito. Quem pediu menos
// movimento no sistema vê o valor final direto.
export function Numero({ valor, formatar, duracao = 900 }: { valor: number; formatar: (n: number) => string; duracao?: number }) {
  const reduzir = useReducedMotion();
  const [mostrado, setMostrado] = useState(reduzir ? valor : 0);
  const anterior = useRef(reduzir ? valor : 0);

  useEffect(() => {
    if (reduzir) {
      setMostrado(valor);
      anterior.current = valor;
      return;
    }
    const de = anterior.current;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 3);
      setMostrado(de + (valor - de) * suave);
      if (t < 1) quadro = requestAnimationFrame(passo);
      else anterior.current = valor;
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracao, reduzir]);

  return <>{formatar(mostrado)}</>;
}

// Barra de progresso que enche do zero até o valor ao aparecer.
export function BarraProgresso({
  pct,
  cor,
  fundo,
  className = "h-1.5",
  atraso = 0.3,
}: {
  pct: number;
  cor: string;
  /** Preenchimento (cor sólida ou degradê); padrão = a própria cor. */
  fundo?: string;
  className?: string;
  atraso?: number;
}) {
  return (
    <div className={`overflow-hidden rounded-full bg-white/10 ${className}`}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.9, ease: EASE, delay: atraso }}
        style={{ background: fundo ?? cor }}
      />
    </div>
  );
}
