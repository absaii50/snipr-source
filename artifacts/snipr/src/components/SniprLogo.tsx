/**
 * Snipr brand mark — two curved chain halves separated by a scissor-cut.
 *
 * @param size      pixel width & height (default 16)
 * @param color     stroke colour when `gradient` is false (default "currentColor")
 * @param gradient  render with the brand purple → cyan gradient
 * @param className optional class forwarded to the root svg
 */
export function SniprLogo({
  size = 16,
  color = "currentColor",
  gradient = false,
  className,
}: {
  size?: number;
  color?: string;
  gradient?: boolean;
  className?: string;
}) {
  // Deterministic id so multiple instances on the page don't collide.
  const uid = gradient ? `snipr-grad-${size}-${color.replace(/[^a-z0-9]/gi, "")}` : "";
  const stroke = gradient ? `url(#${uid})` : color;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {gradient && (
        <defs>
          <linearGradient id={uid} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      )}

      {/* Upper-left chain half — hooks up and left */}
      <path
        d="M13.5 10.5 L10.5 7.5 a3.5 3.5 0 1 0 -4.95 4.95 L8.5 15.5"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Lower-right chain half — hooks down and right */}
      <path
        d="M10.5 13.5 L13.5 16.5 a3.5 3.5 0 1 0 4.95 -4.95 L15.5 8.5"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Scissor "snip" between the halves */}
      <path
        d="M10 14 L14 10"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.5 3"
      />
    </svg>
  );
}
