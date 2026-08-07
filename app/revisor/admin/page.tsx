import { AdminDrillsPanel } from "@/components/revisor/admin-drills-panel";

// Painel administrativo de sugestoes de drill. Sem link visivel no fluxo do
// jogador — acesso direto por URL, restrito por RLS a gsimonetto1@gmail.com
// nas tabelas sensiveis (hand_review_drill_suggestions).
export default function AdminDrillsPage() {
  return <AdminDrillsPanel />;
}
