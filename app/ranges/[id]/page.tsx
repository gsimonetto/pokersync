"use client";

import { use } from "react";
import { Layers } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { RangeEditor } from "@/components/ranges/range-editor";

export default function RangeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <AppHeader insideShell backHref="/ranges" icon={Layers} iconColor="var(--color-review)"
          title={id === "novo" ? "Novo Range" : "Editar Range"} />

        <RangeEditor id={id} />
      </main>
    </AppShell>
  );
}
