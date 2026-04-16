/**
 * Snipr brand logo — broken chain link with dashed cut.
 * Matches the favicon design. Use this for all brand/logo placements.
 *
 * @param size  pixel width & height (default 16)
 * @param color stroke colour (default "currentColor")
 */
export function SniprLogo({
  size = 16,
  color = "currentColor",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="38 52 104 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g stroke={color} strokeWidth="11" strokeLinecap="round" fill="none">
        <path d="M68 68l-18 18a20 20 0 0 0 28.3 28.3l18-18" />
        <path d="M112 112l18-18a20 20 0 0 0-28.3-28.3l-18 18" />
      </g>
      <line
        x1="82"
        y1="98"
        x2="98"
        y2="82"
        stroke={color}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray="4 12"
      />
    </svg>
  );
}
