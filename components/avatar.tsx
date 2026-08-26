import { Crown, Flame, Rocket, Ghost, Cat, Dog, Skull, Dices, type LucideIcon } from "lucide-react";

// Set de avatares "divertidos" — trocado do set original do Vite (nao
// recebido) por um kit de icones com personalidade, cada um com cor propria.
// avatar_id 1-8 cobre os IDs ja usados nos perfis existentes no banco.
export const AVATARS: { id: number; icon: LucideIcon; bg: string }[] = [
  { id: 1, icon: Crown, bg: "#E0B24C" },
  { id: 2, icon: Flame, bg: "#F97316" },
  { id: 3, icon: Rocket, bg: "#5AA6E0" },
  { id: 4, icon: Ghost, bg: "#A855F7" },
  { id: 5, icon: Cat, bg: "#E0559E" },
  { id: 6, icon: Dog, bg: "#2FB89A" },
  { id: 7, icon: Skull, bg: "#8A94A3" },
  { id: 8, icon: Dices, bg: "#EF4444" },
];

export function Avatar({
  id,
  url,
  size = 40,
  shape = "circle",
  onClick,
  title,
  className,
}: {
  id: number;
  url?: string | null;
  size?: number;
  /** "circle" nas miniaturas (padrão); "square" no card de perfil, onde a
      foto ganha mais destaque. */
  shape?: "circle" | "square";
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const shapeClass = shape === "square" ? "rounded-2xl" : "rounded-full";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={title || "Avatar"}
        onClick={onClick}
        title={title}
        className={`${shapeClass} object-cover ${onClick ? "cursor-pointer" : ""} ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const found = AVATARS.find((a) => a.id === id) ?? AVATARS[0];
  const Icon = found.icon;

  return (
    <div
      onClick={onClick}
      title={title}
      className={`grid shrink-0 place-items-center ${shapeClass} ${onClick ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, background: `${found.bg}26`, border: `1.5px solid ${found.bg}66` }}
    >
      <Icon size={Math.round(size * 0.52)} color={found.bg} strokeWidth={1.8} />
    </div>
  );
}
