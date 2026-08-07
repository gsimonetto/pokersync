"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { RevisorFila } from "@/components/revisor/revisor-fila";
import { RevisorNovaMao } from "@/components/revisor/revisor-nova-mao";
import { RevisorDetalhe } from "@/components/revisor/revisor-detalhe";

type Screen = "fila" | "nova" | "detalhe";

// Mesmo padrao de navegacao interna do RevisorView original: troca de tela
// via estado local, sem sub-rotas — replicado 1:1 do Vite.
export default function RevisorPage() {
  const [screen, setScreen] = useState<Screen>("fila");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function goFila() {
    setSelectedId(null);
    setScreen("fila");
  }
  function goNova() {
    setScreen("nova");
  }
  function goDetalhe(id: string) {
    setSelectedId(id);
    setScreen("detalhe");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-ink">
      <header className="mb-4 flex items-center gap-3">
        {screen === "fila" ? (
          <Link
            href="/modulos"
            className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </Link>
        ) : (
          <button
            onClick={goFila}
            className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <BookOpen size={20} className="text-review" />
        <h1 className="m-0 text-xl font-semibold">Revisão de Mãos</h1>
      </header>

      {screen === "fila" && <RevisorFila onNova={goNova} onOpen={goDetalhe} />}
      {screen === "nova" && <RevisorNovaMao onSaved={goFila} onSavedAndReview={goDetalhe} onCancel={goFila} />}
      {screen === "detalhe" && selectedId && <RevisorDetalhe reviewId={selectedId} onBack={goFila} />}
    </main>
  );
}
