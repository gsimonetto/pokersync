import { Crosshair, TrendingUp, Zap, Shield, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Value {
  icon: LucideIcon;
  label: string;
}

const values: Value[] = [
  { icon: Crosshair, label: "Foco" },
  { icon: TrendingUp, label: "Evolução" },
  { icon: Zap, label: "Velocidade" },
  { icon: Shield, label: "Confiança" },
  { icon: User, label: "Jogador" },
];

export function BrandValues() {
  return (
    <section aria-labelledby="values-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="values-heading" className="text-sm font-medium text-muted">
          Tipo de Marca
        </h2>
        <span className="text-xs uppercase tracking-[0.16em] text-muted/60">PokerSync</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-white/[0.07] overflow-hidden rounded-xl border border-hairline bg-surface sm:grid-cols-3 lg:grid-cols-5">
        {values.map(({ icon: Icon, label }, i) => (
          <div
            key={label}
            className={`group flex flex-col items-center gap-3 px-4 py-7 transition-colors hover:bg-white/[0.03] ${
              i === values.length - 1 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <span className="grid size-12 place-items-center rounded-full border border-white/15 text-ink transition-all duration-200 group-hover:scale-105 group-hover:border-white/40">
              <Icon className="size-6" strokeWidth={1.4} />
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted transition-colors group-hover:text-ink">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
