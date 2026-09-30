import type { LucideIcon } from "lucide-react";

export interface ModuleDef {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string;
  available: boolean;
  href?: string;
  // Dado vivo opcional (ex: "Nível 12", nome do time) -- so os modulos
  // que tem informacao barata/relevante pra mostrar aqui recebem isso,
  // o resto do card continua igual sem exigir dado nenhum.
  badge?: string;
  // Bolinha de alerta discreta (ex: notificacao nao lida) no canto do icone.
  dot?: boolean;
}
