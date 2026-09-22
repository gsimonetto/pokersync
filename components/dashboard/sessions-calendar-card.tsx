"use client";

import { Calendar, Clock } from "lucide-react";

interface Session {
  id: string;
  title: string;
  time: string;
  type: "study" | "grind" | "tournament";
  buyin?: string;
}

const SESSIONS: Session[] = [
  {
    id: "1",
    title: "Drilling - 3bet Spot",
    time: "Hoje, 14:00",
    type: "study",
  },
  {
    id: "2",
    title: "Cash Game - Stakes NL10",
    time: "Amanhã, 20:00",
    type: "grind",
    buyin: "$100",
  },
  {
    id: "3",
    title: "SNG - 6max Turbo",
    time: "Sábado, 18:00",
    type: "tournament",
    buyin: "$5",
  },
];

const TYPE_CONFIG = {
  study: { bg: "bg-training/10", border: "border-training/30", label: "Estudo" },
  grind: { bg: "bg-positive/10", border: "border-positive/30", label: "Grind" },
  tournament: { bg: "bg-evolution/10", border: "border-evolution/30", label: "Torneio" },
};

export function SessionsCalendarCard() {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-elevated via-surface to-elevated p-6 backdrop-blur-xl transition-all duration-300 hover:border-evolution/40">
      {/* Glow ambient */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-evolution/20 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Próximas Sessões
          </h3>
          <Calendar size={16} className="text-muted/40" />
        </div>

        <div className="space-y-3">
          {SESSIONS.map((session) => {
            const config = TYPE_CONFIG[session.type];
            return (
              <div
                key={session.id}
                className={`flex items-start gap-3 rounded-lg border ${config.border} ${config.bg} p-3 backdrop-blur-sm transition-all hover:border-opacity-60`}
              >
                <Clock size={16} className="mt-1 flex-shrink-0 text-muted/60" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{session.title}</p>
                  <p className="text-xs text-muted/60 mt-1">{session.time}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="inline-block text-xs font-semibold uppercase tracking-widest px-2 py-1 rounded-full bg-hairline text-muted/60">
                    {config.label}
                  </span>
                  {session.buyin && (
                    <p className="text-xs text-muted/60 mt-1">{session.buyin}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
