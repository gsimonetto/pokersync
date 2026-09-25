"use client";

import { Check } from "lucide-react";
import { Card } from "@/components/drill/card";
import {
  salvarPreferenciaMesa,
  usePreferenciasMesa,
  type Baralho,
  type CorFeltro,
  type TempoDecisao,
  type UnidadeValor,
  type VelocidadeAnimacao,
} from "@/lib/hooks/use-preferencias-mesa";

// Aba "Mesa" das Configurações: cor do feltro e baralho (M9), BB ou
// fichas no Revisor (M8), velocidade das animações (M10) e tempo pra
// decidir no Treino (M11). Cada escolha vale na hora e fica guardada na
// conta (ver use-preferencias-mesa).

const FELTROS: { valor: CorFeltro; rotulo: string; fundo: string }[] = [
  // "Padrão" = cada tela com a sua cor de sempre (Treino azul, Revisor vinho).
  { valor: "padrao", rotulo: "Padrão", fundo: "linear-gradient(135deg, #123A6E 0 50%, #7A1830 50% 100%)" },
  { valor: "verde", rotulo: "Verde", fundo: "radial-gradient(circle at 50% 40%, #1E6B41, #0E3A22)" },
  { valor: "azul", rotulo: "Azul", fundo: "radial-gradient(circle at 50% 40%, #123A6E, #0A1D38)" },
  { valor: "vinho", rotulo: "Vinho", fundo: "radial-gradient(circle at 50% 40%, #7A1830, #3D0C18)" },
  { valor: "grafite", rotulo: "Grafite", fundo: "radial-gradient(circle at 50% 40%, #3A3F47, #1D2025)" },
];

const BARALHOS: { valor: Baralho; rotulo: string }[] = [
  { valor: "4cores", rotulo: "4 cores (padrão)" },
  { valor: "2cores", rotulo: "2 cores" },
];

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12.5px] font-medium text-ink">{titulo}</span>
      {children}
      {ajuda && <p className="m-0 text-[11.5px] leading-snug text-muted">{ajuda}</p>}
    </div>
  );
}

// Botões lado a lado, no mesmo visual dos "dias da semana" do perfil.
function Opcoes<T extends string | number>({ opcoes, valor, onChange }: { opcoes: { valor: T; rotulo: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={String(o.valor)}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(o.valor)}
            className={`rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
              ativo ? "border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f1d78a]" : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-ink"
            }`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function PreferenciasMesaPainel() {
  const pref = usePreferenciasMesa();
  return (
    <div className="flex flex-col gap-5">
      <Secao titulo="Cor da mesa" ajuda="Vale no Treino e no Revisor. Padrão: azul no Treino e vinho no Revisor.">
        <div className="flex flex-wrap gap-3">
          {FELTROS.map((f) => {
            const ativo = pref.feltro === f.valor;
            return (
              <button
                key={f.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => salvarPreferenciaMesa("feltro", f.valor)}
                className="flex flex-col items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-ink"
              >
                <span
                  className={`relative grid h-9 w-14 place-items-center rounded-full border-2 ${ativo ? "border-[#d4af37]" : "border-transparent"}`}
                  style={{ background: f.fundo, boxShadow: "inset 0 0 0 3px rgba(0,0,0,.55)" }}
                >
                  {ativo && <Check size={14} className="text-ink" strokeWidth={3} />}
                </span>
                <span className={ativo ? "text-ink" : undefined}>{f.rotulo}</span>
              </button>
            );
          })}
        </div>
      </Secao>

      <Secao titulo="Baralho" ajuda="No de 2 cores, ouros fica vermelho como copas e paus fica preto como espadas.">
        <div className="grid grid-cols-2 gap-2">
          {BARALHOS.map((b) => {
            const ativo = pref.baralho === b.valor;
            return (
              <button
                key={b.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => salvarPreferenciaMesa("baralho", b.valor)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-2.5 transition-colors ${
                  ativo ? "border-[#d4af37]/50 bg-[#d4af37]/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <span className="flex gap-1">
                  {["As", "Kh", "Qd", "Jc"].map((c) => (
                    <Card key={c} card={c} size="mini" baralho={b.valor} />
                  ))}
                </span>
                <span className={`text-[11px] font-semibold ${ativo ? "text-ink" : "text-muted"}`}>{b.rotulo}</span>
              </button>
            );
          })}
        </div>
      </Secao>

      <Secao titulo="Valores no Revisor" ajuda="Stacks, apostas e pote em big blinds ou em fichas, como nas salas.">
        <Opcoes<UnidadeValor>
          opcoes={[
            { valor: "bb", rotulo: "BB" },
            { valor: "fichas", rotulo: "Fichas" },
          ]}
          valor={pref.unidade}
          onChange={(v) => salvarPreferenciaMesa("unidade", v)}
        />
      </Secao>

      <Secao titulo="Animações no Treino" ajuda="Rápida ou sem animação ajudam quem treina muito volume.">
        <Opcoes<VelocidadeAnimacao>
          opcoes={[
            { valor: "normal", rotulo: "Normal" },
            { valor: "rapida", rotulo: "Rápida" },
            { valor: "sem", rotulo: "Sem animação" },
          ]}
          valor={pref.animacao}
          onChange={(v) => salvarPreferenciaMesa("animacao", v)}
        />
      </Secao>

      <Secao titulo="Tempo pra decidir no Treino" ajuda="Quando o tempo acaba, a mão conta como Fold, igual à mesa de verdade.">
        <Opcoes<TempoDecisao>
          opcoes={[
            { valor: 0, rotulo: "Sem tempo" },
            { valor: 10, rotulo: "10 s" },
            { valor: 15, rotulo: "15 s" },
            { valor: 20, rotulo: "20 s" },
          ]}
          valor={pref.tempo}
          onChange={(v) => salvarPreferenciaMesa("tempo", v)}
        />
      </Secao>

      <p className="m-0 text-[11px] text-muted">As escolhas ficam salvas na sua conta e valem em qualquer aparelho.</p>
    </div>
  );
}
