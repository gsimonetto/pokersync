"use client";

import { X } from "lucide-react";
import { RangeList } from "@/components/ranges/range-list";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";

export function RangeListModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-xl border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Meus Ranges</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <RangeList />
      </div>
    </div>
  );
}
