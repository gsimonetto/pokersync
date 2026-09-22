"use client";

import { CheckCircle2, Circle } from "lucide-react";

interface Habit {
  id: string;
  label: string;
  completed: boolean[];
  icon: string;
  accentColor: string;
}

const HABITS: Habit[] = [
  {
    id: "volume",
    label: "Volume de Mãos",
    icon: "🃏",
    accentColor: "from-review",
    completed: [true, true, true, true, false, false, false],
  },
  {
    id: "drills",
    label: "Drills Completados",
    icon: "⚡",
    accentColor: "from-positive",
    completed: [true, true, false, true, true, false, false],
  },
  {
    id: "journal",
    label: "Journal Semanal",
    icon: "📔",
    accentColor: "from-training",
    completed: [true, true, true, false, false, false, false],
  },
];

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

export function WeeklyHabitsCard() {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-elevated via-surface to-elevated p-6 backdrop-blur-xl transition-all duration-300 hover:border-training/40">
      {/* Glow ambient */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-training/20 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative space-y-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Suas Metas Esta Semana</h3>

        {HABITS.map((habit) => (
          <div key={habit.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink flex items-center gap-2">
                <span className="text-lg">{habit.icon}</span>
                {habit.label}
              </span>
              <span className="text-xs text-muted">
                {habit.completed.filter(Boolean).length}/{habit.completed.length}
              </span>
            </div>

            <div className="flex gap-2">
              {DAYS.map((day, idx) => (
                <div key={day} className="flex flex-col items-center gap-1">
                  <button
                    className={`transition-all ${
                      habit.completed[idx]
                        ? `text-review`
                        : "text-hairline hover:text-muted/60"
                    }`}
                  >
                    {habit.completed[idx] ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>
                  <span className="text-xs text-muted/60">{day}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
