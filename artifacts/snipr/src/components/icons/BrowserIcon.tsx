/**
 * Monochrome browser brand icons. Renders in `currentColor` so they inherit
 * text colour from parent — keeps the analytics UI consistent with lucide icons.
 *
 * Falls back to a generic globe glyph for unknown browsers.
 */

type IconProps = { size?: number; className?: string };

function Svg({ size = 14, children, viewBox = "0 0 24 24", className }: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ChromeMark(props: IconProps) {
  // Stylised Chrome — outer ring + inner dot
  return (
    <Svg {...props}>
      <path d="M12 2a10 10 0 0 1 8.66 5H12a5 5 0 0 0-4.33 2.5L3.34 7A10 10 0 0 1 12 2Zm9.54 7H13a3 3 0 1 1-2.6 4.5L6.1 21.2A10 10 0 0 0 22 12a10 10 0 0 0-.46-3ZM4.9 19.9 9.23 12.4A5 5 0 0 0 12 17a4.93 4.93 0 0 0 .8-.07L10.4 21.9A10 10 0 0 1 4.9 19.9ZM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
    </Svg>
  );
}

function FirefoxMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20.5 8.2a8.5 8.5 0 0 1-1.5 6.8A9 9 0 1 1 4 6.5a6 6 0 0 0 2 4.9A5 5 0 0 1 9 5a4 4 0 0 0 4 3 3 3 0 0 1 2.5-3 6 6 0 0 1 2 1.2 5 5 0 0 1 3 2ZM9 16a3.5 3.5 0 1 0 5-3 3 3 0 0 1-5 3Z" />
    </Svg>
  );
}

function SafariMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm3-11-5 2-2 5 5-2Zm-3 2a1 1 0 1 1-1 1 1 1 0 0 1 1-1Z" />
    </Svg>
  );
}

function EdgeMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2a10 10 0 0 1 9.2 6.1A8 8 0 0 0 9.4 13a4 4 0 0 0 3.6 4 5.5 5.5 0 0 0 4-1.7 10 10 0 0 1-7.4 6.6A10 10 0 0 1 2.8 9.3 10 10 0 0 1 12 2Zm1.9 6.4A6 6 0 0 1 19 11a5.8 5.8 0 0 1-2 4.5l-.3.2a3 3 0 0 1-2.7 1.3 2 2 0 0 1-2-2 6 6 0 0 1 2-4.4 5.7 5.7 0 0 1 0-2.2Z" />
    </Svg>
  );
}

function OperaMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 16c-2.2 0-4-2.7-4-6s1.8-6 4-6 4 2.7 4 6-1.8 6-4 6Z" />
    </Svg>
  );
}

function BraveMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19.5 5.6 18 4.2 16 5 12 4 8 5 6 4.2 4.5 5.6 5.6 7.2 4.7 9.5 6 15.5l6 4.5 6-4.5 1.3-6L18.4 7.2ZM12 17.8l-3.7-2.3.9-3.7L12 10.5l2.8 1.3.9 3.7Z" />
    </Svg>
  );
}

function SamsungMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm3 13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1h2v1h2v-1.7L9 11.6A2 2 0 0 1 8 10V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1h-2V9h-2v1.6L14 12a2 2 0 0 1 1 1.7Z" />
    </Svg>
  );
}

function GlobeMark(props: IconProps) {
  return (
    <Svg {...props} viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
      </g>
    </Svg>
  );
}

export function BrowserIcon({ browser, size = 14, className }: { browser: string | null } & IconProps) {
  const name = (browser ?? "").toLowerCase();
  if (name.includes("chrome")) return <ChromeMark size={size} className={className} />;
  if (name.includes("firefox")) return <FirefoxMark size={size} className={className} />;
  if (name.includes("safari")) return <SafariMark size={size} className={className} />;
  if (name.includes("edge")) return <EdgeMark size={size} className={className} />;
  if (name.includes("opera")) return <OperaMark size={size} className={className} />;
  if (name.includes("brave")) return <BraveMark size={size} className={className} />;
  if (name.includes("samsung")) return <SamsungMark size={size} className={className} />;
  return <GlobeMark size={size} className={className} />;
}
