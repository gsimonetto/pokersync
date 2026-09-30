"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, FileText } from "lucide-react";
import { TelaVidro } from "@/components/ui/tela-vidro";
import { fetchNaoLidas, MENSAGENS_LIDAS } from "@/lib/services/marketplace-service";

type AbaVagas = "vagas" | "candidaturas";

const ROTA: Record<AbaVagas, string> = {
  vagas: "/marketplace",
  candidaturas: "/marketplace/minhas-candidaturas",
};

// Casca das telas das Vagas: moldura padrão (TelaVidro) com as abas Vagas
// e Minhas candidaturas -- cada aba é uma página. "Minhas candidaturas"
// mostra quantas mensagens do time a pessoa ainda não leu.
export function CascaVagas({
  titulo,
  subtitulo,
  acoes,
  aba,
  atalhos = true,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  /** Sem aba = tela sem a barra (ex.: Nova vaga). */
  aba?: AbaVagas;
  /** Teclas 1 e 2 trocam de aba -- desligue em telas de detalhe. */
  atalhos?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    if (!aba) return;
    const buscar = () =>
      fetchNaoLidas()
        .then((n) => setNaoLidas(n.minhas))
        .catch(() => {});
    buscar();
    window.addEventListener(MENSAGENS_LIDAS, buscar);
    return () => window.removeEventListener(MENSAGENS_LIDAS, buscar);
  }, [aba]);
  return (
    <TelaVidro<AbaVagas>
      titulo={titulo}
      subtitulo={subtitulo}
      acoes={acoes}
      abas={
        aba && {
          value: aba,
          onChange: (v) => v !== aba && router.push(ROTA[v]),
          rotulo: "Seções das Vagas",
          atalhos,
          options: [
            { value: "vagas", label: "Vagas", icon: Briefcase },
            { value: "candidaturas", label: "Minhas candidaturas", icon: FileText, badge: naoLidas || undefined },
          ],
        }
      }
    >
      {children}
    </TelaVidro>
  );
}
