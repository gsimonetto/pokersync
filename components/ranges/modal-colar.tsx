"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BOTAO_OURO, BOTAO_VIDRO, CAMPO } from "@/components/banca/util";
import { contarCombos, lerTextoRange, type Pesos } from "@/lib/ranges/notacao";
import { TOTAL_COMBOS, numCombos, pct } from "./pecas";

// Colar um range em texto (de outro programa, do coach, de um fórum) e
// copiar o range aberto pra levar pra outro lugar.

export function ModalColar({
  aberto,
  textoAtual,
  onUsar,
  onFechar,
}: {
  aberto: boolean;
  textoAtual: string;
  onUsar: (r: { pesos: Pesos; pesosCombo: Pesos }) => void;
  onFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (aberto) {
      setTexto("");
      setCopiado(false);
    }
  }, [aberto]);

  const lido = useMemo(() => (texto.trim() ? lerTextoRange(texto) : null), [texto]);
  const combos = lido ? contarCombos(lido.pesos, lido.pesosCombo) : 0;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoAtual);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Modal open={aberto} onClose={onFechar} title="Colar range" wide>
      <p className="m-0 text-[12.5px] leading-relaxed text-muted">
        Cole o range no formato de sempre dos programas de poker: <b className="text-ink/85">22+, A2s+, KTo+, AsKs</b>. Peso de uma mão:{" "}
        <b className="text-ink/85">A5s:50</b> ou em bloco <b className="text-ink/85">[50]A5s, A4s[/50]</b>.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Ex.: 22+, A2s+, K9s+, QTs+, JTs, ATo+, KJo+"
        aria-label="Range em texto"
        className={`${CAMPO} mt-3 resize-y font-mono text-[12.5px]`}
      />
      {lido && (
        <div className="mt-2 text-[12px]">
          <span className="tnum text-ink/85">
            {numCombos(combos)} combos · {pct(combos / TOTAL_COMBOS)} das mãos
          </span>
          {lido.erros.length > 0 && <span className="ml-2 text-negative">Não entendi: {lido.erros.slice(0, 6).join(", ")}</span>}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!lido || combos === 0}
          onClick={() => {
            if (!lido) return;
            onUsar({ pesos: lido.pesos, pesosCombo: lido.pesosCombo });
            onFechar();
          }}
          className={BOTAO_OURO}
        >
          Usar esse range
        </button>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink">O range aberto, em texto</span>
          <button type="button" onClick={copiar} disabled={!textoAtual} className={`${BOTAO_VIDRO} !px-3 !py-1.5 text-[12.5px]`}>
            {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="m-0 mt-2 max-h-28 overflow-y-auto break-words rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 font-mono text-[12px] text-ink/80">
          {textoAtual || "O range aberto está vazio."}
        </p>
      </div>
    </Modal>
  );
}
