import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center ${className ?? ""}`}>
      <Image
        src="/pokersync-logo.svg"
        alt="PokerSync"
        width={160}
        height={49}
        priority
        className="h-8 w-auto sm:h-9"
      />
    </div>
  );
}
