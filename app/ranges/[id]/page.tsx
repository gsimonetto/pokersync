"use client";

import { use } from "react";
import { Layers } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RangeEditor } from "@/components/ranges/range-editor";

export default function RangeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-3 text-ink">
      <AppHeader backHref="/ranges" icon={Layers} iconColor="var(--color-review)"
        title={id === "novo" ? "Novo Range" : "Editar Range"} />

      <RangeEditor id={id} />
    </main>
  );
}
