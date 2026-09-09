"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/chip";
import { fetchMyApplications, FORMAT_LABEL, APPLICATION_STATUS_LABEL, type MyApplication } from "@/lib/services/marketplace-service";

const STATUS_COLOR: Record<MyApplication["status"], string> = {
  pendente: "#E0B24C",
  aceita: "#2FB89A",
  recusada: "#e0555a",
  retirada: "#8A94A3",
};

export default function MinhasCandidaturasPage() {
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetchMyApplications()
      .then(setApps)
      .catch((e) => setErro(e?.message ?? "Não foi possível carregar suas candidaturas."));
  }, []);

  return (
    <AppShell>
      <main className="w-full px-6 py-10 text-ink">
        {erro && (
          <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
        )}

        <div className="mx-auto max-w-2xl rounded-2xl border border-hairline bg-surface p-5 sm:p-6">
          {apps === null ? (
            <div className="flex items-center justify-center rounded-lg border border-hairline bg-elevated p-10">
              <Loader2 size={18} className="animate-spin text-muted" />
            </div>
          ) : apps.length === 0 ? (
            <div className="rounded-lg border border-hairline bg-elevated p-6 text-center text-sm text-muted">
              Você ainda não se candidatou a nenhuma vaga.{" "}
              <Link href="/marketplace" className="font-semibold text-ink underline-offset-2 hover:underline">
                Ver vagas abertas
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {apps.map((a) => (
                <Link
                  key={a.id}
                  href={`/marketplace/${a.listingId}`}
                  className="flex items-center gap-4 rounded-lg border border-hairline bg-elevated p-4 transition-colors hover:border-white/15"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink">{a.listing.title}</p>
                      <Chip color="#5AA6E0" size="sm">
                        {FORMAT_LABEL[a.listing.format]}
                      </Chip>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">{a.listing.teamName}</p>
                    {a.status === "recusada" && a.decisionNote && (
                      <p className="mt-1 text-xs italic text-muted">&ldquo;{a.decisionNote}&rdquo;</p>
                    )}
                  </div>
                  {a.matchScore !== null && (
                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-bold tabular-nums ${a.matchScore >= 70 ? "text-positive" : "text-negative"}`}>
                        {a.matchScore}
                      </p>
                      <p className="text-[9px] uppercase tracking-wider text-muted/60">match</p>
                    </div>
                  )}
                  <Chip color={STATUS_COLOR[a.status]}>{APPLICATION_STATUS_LABEL[a.status]}</Chip>
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
