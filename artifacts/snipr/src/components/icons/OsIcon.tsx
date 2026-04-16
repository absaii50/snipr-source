/**
 * Monochrome OS brand icons in `currentColor`. Mirrors the style of BrowserIcon
 * so the analytics UI has consistent tabular glyphs instead of multicoloured emoji.
 */

type IconProps = { size?: number; className?: string };

function Svg({ size = 14, children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function WindowsMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 5.5 11 4.3v7.2H3Zm0 7.5h8v7.2L3 19Zm9-8.8 9-1.3v8.6h-9Zm0 8.8h9V22l-9-1.3Z" />
    </Svg>
  );
}

function AppleMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17.05 13.07a4.3 4.3 0 0 1 2.05-3.6 4.4 4.4 0 0 0-3.46-1.87c-1.46-.15-2.85.87-3.6.87s-1.9-.85-3.13-.83A4.6 4.6 0 0 0 5 10.02c-1.66 2.9-.43 7.2 1.2 9.54.8 1.16 1.75 2.45 2.99 2.4 1.2-.05 1.65-.78 3.1-.78s1.86.78 3.13.75c1.3-.02 2.12-1.16 2.91-2.33a10 10 0 0 0 1.33-2.73 4.15 4.15 0 0 1-2.6-3.8ZM14.7 6.02a4.1 4.1 0 0 0 .95-3A4.1 4.1 0 0 0 12.97 4.4a3.9 3.9 0 0 0-1 2.9 3.4 3.4 0 0 0 2.72-1.28Z" />
    </Svg>
  );
}

function AndroidMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17.6 9.5 19 7a.5.5 0 0 0-.87-.5l-1.42 2.5a8.3 8.3 0 0 0-5.42 0L5.87 6.5A.5.5 0 0 0 5 7l1.4 2.5A7 7 0 0 0 3 15.5h18a7 7 0 0 0-3.4-6ZM8 13.5a1 1 0 1 1 1-1 1 1 0 0 1-1 1Zm8 0a1 1 0 1 1 1-1 1 1 0 0 1-1 1Z" />
    </Svg>
  );
}

function LinuxMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2c-2.5 0-4 2-4 5v1a4 4 0 0 0-2 3.5 25 25 0 0 0-1.5 5c-.2.8-.3 1.7.4 2.2.8.5 1.8-.1 2.4-.6a6 6 0 0 0 1.2-1.5A5 5 0 0 0 12 19a5 5 0 0 0 3.5-2.4 6 6 0 0 0 1.2 1.5c.6.5 1.6 1.1 2.4.6.7-.5.6-1.4.4-2.2a25 25 0 0 0-1.5-5A4 4 0 0 0 16 8V7c0-3-1.5-5-4-5Zm-1.5 4.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM12 13a2 2 0 0 0 1.4-.5l1.3 1a3 3 0 0 1-5.4 0l1.3-1A2 2 0 0 0 12 13Z" />
    </Svg>
  );
}

function MonitorMark(props: IconProps) {
  return (
    <Svg {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="4" width="19" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </g>
    </Svg>
  );
}

export function OsIcon({ os, size = 14, className }: { os: string | null } & IconProps) {
  const name = (os ?? "").toLowerCase();
  if (name.includes("windows")) return <WindowsMark size={size} className={className} />;
  if (name.includes("mac") || name.includes("os x") || name.includes("ios")) return <AppleMark size={size} className={className} />;
  if (name.includes("android")) return <AndroidMark size={size} className={className} />;
  if (name.includes("linux")) return <LinuxMark size={size} className={className} />;
  return <MonitorMark size={size} className={className} />;
}
