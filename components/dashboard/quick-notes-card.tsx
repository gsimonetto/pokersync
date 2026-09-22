"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface Note {
  id: string;
  text: string;
  created: string;
}

const INITIAL_NOTES: Note[] = [
  {
    id: "1",
    text: "Opponent em UTG sempre 3bet com 2x raise - explorar com calls mais wide",
    created: "Há 2 horas",
  },
  {
    id: "2",
    text: "Revisar estratégia vs tight players - estou folding muito wide",
    created: "Ontem",
  },
  {
    id: "3",
    text: "Linha: AQ disjogou preflop 3bet - pensar em coldcall mais",
    created: "Ontem",
  },
];

export function QuickNotesCard() {
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [newNote, setNewNote] = useState("");

  function addNote() {
    if (!newNote.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      text: newNote,
      created: "Agora",
    };
    setNotes([note, ...notes]);
    setNewNote("");
  }

  function deleteNote(id: string) {
    setNotes(notes.filter((n) => n.id !== id));
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-elevated via-surface to-elevated p-6 backdrop-blur-xl transition-all duration-300 hover:border-review/40">
      {/* Glow ambient */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-review/20 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Anotações Rápidas
          </h3>
          <span className="text-xs text-muted/60">{notes.length} notas</span>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addNote()}
            placeholder="Adicionar insight..."
            className="flex-1 rounded-lg border border-hairline bg-surface/40 px-3 py-2 text-sm text-ink placeholder:text-muted/40 transition-colors hover:border-muted/30 focus:outline-none focus:border-review/50 focus:bg-surface/60"
          />
          <button
            onClick={addNote}
            className="flex items-center justify-center size-10 rounded-lg border border-review/30 bg-review/10 transition-all hover:border-review/60 hover:bg-review/20"
          >
            <Plus size={18} className="text-review" />
          </button>
        </div>

        {/* Notes list */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group/note flex items-start gap-3 rounded-lg border border-hairline bg-surface/40 p-3 transition-all hover:border-muted/30 hover:bg-surface/60"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink/90">{note.text}</p>
                <p className="text-xs text-muted/50 mt-1.5">{note.created}</p>
              </div>
              <button
                onClick={() => deleteNote(note.id)}
                className="flex-shrink-0 opacity-0 transition-all group-hover/note:opacity-100 text-muted hover:text-negative"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
