export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <svg
        width="46"
        height="34"
        viewBox="0 0 46 34"
        fill="none"
        aria-hidden="true"
        className="text-ink"
      >
        <rect
          x="4.4"
          y="6.6"
          width="15.5"
          height="21"
          rx="3.2"
          transform="rotate(-13 4.4 6.6)"
          stroke="currentColor"
          strokeWidth="1.8"
          className="opacity-70"
        />
        <rect
          x="10.5"
          y="6"
          width="15.5"
          height="21"
          rx="3.2"
          fill="var(--background)"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M18.2 11.2c1.9 2 3.7 3 3.7 5.1a2.1 2.1 0 0 1-3.4 1.65 2.1 2.1 0 0 1-3.4-1.65c0-2.1 1.8-3.1 3.1-5.1Z"
          fill="currentColor"
        />
        <path d="M18.25 16.6 19.5 21h-2.5l1.25-4.4Z" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="29.5" y1="12.5" x2="38" y2="12.5" />
          <line x1="31.5" y1="17" x2="44" y2="17" />
          <line x1="29.5" y1="21.5" x2="38" y2="21.5" />
        </g>
      </svg>

      <span className="text-[17px] font-semibold uppercase leading-none tracking-[0.34em] text-ink">
        Poker<span className="font-normal tracking-[0.32em] text-ink/85">Sync</span>
      </span>
    </div>
  );
}
