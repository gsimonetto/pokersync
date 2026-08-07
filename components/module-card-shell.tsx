"use client";

import { useState, useCallback, type ReactNode } from "react";

// So esta parte precisa de estado (toque no celular). Recebe apenas
// dados serializaveis (string, boolean) + o conteudo ja renderizado
// pelo Server Component pai — nunca uma funcao/componente como prop,
// que e o que quebra o build ao atravessar a fronteira Server->Client.
export function ModuleCardShell({
  accent,
  available,
  children,
}: {
  accent: string;
  available: boolean;
  children: ReactNode;
}) {
  const [active, setActive] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") setActive(true);
  }, []);

  const endTouch = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") {
      window.setTimeout(() => setActive(false), 180);
    }
  }, []);

  return (
    <article
      style={{ "--acc": accent } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerUp={endTouch}
      onPointerCancel={endTouch}
      className={
        "group acc-card relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl border border-hairline bg-surface p-4 " +
        (available ? "acc-lift cursor-pointer" : "opacity-50") +
        (active ? " is-active" : "")
      }
    >
      {children}
    </article>
  );
}
