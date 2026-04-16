"use client";
import { Globe } from "lucide-react";

/**
 * Country flag rendered via flagcdn.com PNG (2x retina). Falls back to a
 * lucide Globe glyph when the code is missing/invalid or the image fails to
 * load. Consistent visual style across dashboard, Live feed, and analytics.
 */
export function CountryFlag({
  code,
  width = 20,
  className,
}: {
  code: string | null | undefined;
  width?: number;
  className?: string;
}) {
  const height = Math.round((width * 3) / 4);
  if (!code || code.length !== 2) {
    return <Globe width={width - 4} height={width - 4} className={`text-[#71717A] ${className ?? ""}`} strokeWidth={1.75} />;
  }
  const lower = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w${width}/${lower}.png`}
      srcSet={`https://flagcdn.com/w${width * 2}/${lower}.png 2x`}
      width={width}
      height={height}
      alt={code}
      className={`rounded-[2px] object-cover shrink-0 ${className ?? ""}`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
