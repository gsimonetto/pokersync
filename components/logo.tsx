import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/pokersync-logo.svg"
      alt="PokerSync"
      width={1340}
      height={330}
      priority
      className={className ?? "h-11 w-auto sm:h-14"}
    />
  );
}
