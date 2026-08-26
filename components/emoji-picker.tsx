"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

// Emojis de poker primeiro (o publico daqui e' jogador, isso e' o que
// mais vai sair usando pra reagir a uma mao ou comemorar um resultado),
// depois um set comum de reacoes -- cobre o essencial sem virar um
// seletor gigante tipo Unicode completo (sem lib externa de proposito,
// e' so' texto unicode nativo).
const POKER_EMOJIS = [
  "♠️", "♥️", "♦️", "♣️", "🃏", "🎰", "💰", "💵",
  "💸", "🏆", "👑", "🔥", "🤑", "😎", "🎯", "📈",
  "📉", "🍀", "🚀", "💯", "🙌", "💪", "🤞", "😅",
];

const COMUNS_EMOJIS = [
  "😀", "😂", "🙂", "😉", "😢", "😡", "😱", "😴",
  "👍", "👎", "❤️", "🙏", "👏", "✅", "❌", "🤔",
  "🎉", "😬",
];

// Botao de emoji reutilizado no composer do chat (Central de
// Conversas + ConversaDrawer) e nas interacoes do Funil. Popover
// simples ancorado no proprio botao -- fecha ao clicar fora, com Esc,
// ou ao escolher um emoji.
export function EmojiPickerButton({
  onPick,
  title = "Adicionar emoji",
  className,
}: {
  onPick: (emoji: string) => void;
  title?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("mousedown", aoClicarFora);
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("mousedown", aoClicarFora);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title={title}
        aria-label={title}
        className={
          className ??
          "grid size-9 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink"
        }
      >
        <Smile size={15} />
      </button>

      {aberto && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-hairline bg-surface p-3 shadow-2xl shadow-black/60">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted/70">Poker</p>
          <div className="mb-3 grid grid-cols-8 gap-1">
            {POKER_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onPick(e);
                  setAberto(false);
                }}
                className="grid size-7 place-items-center rounded-md text-base transition-colors hover:bg-white/[0.08]"
                aria-label={e}
              >
                {e}
              </button>
            ))}
          </div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted/70">Comuns</p>
          <div className="grid grid-cols-8 gap-1">
            {COMUNS_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onPick(e);
                  setAberto(false);
                }}
                className="grid size-7 place-items-center rounded-md text-base transition-colors hover:bg-white/[0.08]"
                aria-label={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
