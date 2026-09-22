"use client";

import { useRouter } from "next/navigation";
import { BookOpenCheck, NotebookPen, Play, Plus, Target } from "lucide-react";

// Evento interno do painel: a barra pede e o card do timer obedece.
// Um CustomEvent evita subir o estado do timer pra página inteira só
// por causa de um botão -- o card continua dono do próprio relógio.
export const EVENTO_INICIAR_FOCO = "psd:iniciar-foco";
// Mesma ideia pro bloco de notas: o campo de escrita vive dentro do
// card, então a barra só manda focar nele.
export const ID_CAMPO_NOTA = "psd-campo-nota";

type Acao = {
  label: string;
  icon: typeof Play;
  cor: string;
  aoClicar: (router: ReturnType<typeof useRouter>) => void;
};

// Ações rápidas — o que o jogador FAZ, não pra onde ele vai (a navegação
// é papel da lateral). Duas agem na própria tela (foco e anotação) e
// três abrem o módulo já na tarefa pretendida.
const ACOES: Acao[] = [
  {
    label: "Iniciar foco",
    icon: Play,
    cor: "#a855f7",
    aoClicar: () => window.dispatchEvent(new CustomEvent(EVENTO_INICIAR_FOCO)),
  },
  {
    label: "Treinar",
    icon: Target,
    cor: "#2FB89A",
    aoClicar: (router) => router.push("/treino"),
  },
  {
    label: "Enviar mão",
    icon: BookOpenCheck,
    cor: "#A855F7",
    aoClicar: (router) => router.push("/revisor"),
  },
  {
    label: "Registrar sessão",
    icon: Plus,
    cor: "#5AA6E0",
    aoClicar: (router) => router.push("/banca"),
  },
  {
    label: "Anotar",
    icon: NotebookPen,
    cor: "#E0B24C",
    aoClicar: () => {
      const campo = document.getElementById(ID_CAMPO_NOTA);
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      (campo as HTMLInputElement | null)?.focus({ preventScroll: true });
    },
  },
];

// No celular a barra fica no fluxo normal, logo abaixo do cabeçalho
// (rolável na horizontal), porque o rodapé de lá é ocupado pela
// navegação. No computador ela vira flutuante no rodapé, no lugar que
// era do dock de navegação -- ver app/design/dashboard/page.tsx.
export function QuickActionsBar() {
  const router = useRouter();

  return (
    <div className="psd-card psd-scroll mt-5 flex gap-1 overflow-x-auto p-1.5 lg:fixed lg:bottom-5 lg:left-1/2 lg:z-30 lg:mt-0 lg:w-auto lg:-translate-x-1/2 lg:overflow-visible">
      {ACOES.map(({ label, icon: Icon, cor, aoClicar }) => (
        <button
          key={label}
          type="button"
          onClick={() => aoClicar(router)}
          className="flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/8 hover:text-white"
        >
          <Icon size={16} color={cor} />
          {label}
        </button>
      ))}
    </div>
  );
}
