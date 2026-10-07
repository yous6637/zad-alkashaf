export function ScoutEmblem({ className = "size-full" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#fff" />
      <circle cx="40" cy="40" r="35.5" fill="none" stroke="#166534" strokeWidth="1.4" />
      <path
        fill="#12382c"
        d="M40 12c2.2 6.2 5.4 11.2 9.6 15.1-3.1 1.1-6.4 1.8-9.6 2.1-3.2-.3-6.5-1-9.6-2.1C34.6 23.2 37.8 18.2 40 12Z"
      />
      <path
        fill="#166534"
        d="M24.2 30.8c6.4 1.8 11.3 2.7 15.8 2.8v22.6c-6.8-2.2-12.4-7.4-16.6-15.3-1.4-2.7-2.3-6.1 0.8-10.1Zm31.6 0c3.1 4 2.2 7.4.8 10.1-4.2 7.9-9.8 13.1-16.6 15.3V33.6c4.5-.1 9.4-1 15.8-2.8Z"
      />
      <path fill="#f5c518" d="M38.6 34.2h2.8v20.4h-2.8Z" />
      <circle cx="40" cy="32.6" r="2.2" fill="#f5c518" />
      <path fill="#12382c" d="M28 58.5h24l-2.2 5.8H30.2Z" />
    </svg>
  );
}

export function ScoutHat({ className = "size-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 88" className={className} aria-hidden="true">
      <ellipse cx="60" cy="72" rx="52" ry="10" fill="#0c241c" />
      <path fill="#d9c39a" d="M14 64c8-18 22-34 46-34s38 16 46 34c-14 8-30 12-46 12S28 72 14 64Z" />
      <path fill="#c4aa7a" d="M28 58c7-12 17-20 32-20s25 8 32 20c-10 5-21 8-32 8s-22-3-32-8Z" />
      <path fill="#166534" d="M52 40h16l-2 10H54Z" />
      <circle cx="60" cy="38" r="5" fill="#12382c" />
      <circle cx="60" cy="38" r="2.2" fill="#f5c518" />
    </svg>
  );
}
