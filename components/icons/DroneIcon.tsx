import type { SVGProps } from "react";

export function DroneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Center body */}
      <rect x="9" y="9" width="6" height="6" rx="1" />
      {/* Arms */}
      <line x1="9" y1="9" x2="5" y2="5" />
      <line x1="15" y1="9" x2="19" y2="5" />
      <line x1="9" y1="15" x2="5" y2="19" />
      <line x1="15" y1="15" x2="19" y2="19" />
      {/* Rotors */}
      <circle cx="4" cy="4" r="2.5" />
      <circle cx="20" cy="4" r="2.5" />
      <circle cx="4" cy="20" r="2.5" />
      <circle cx="20" cy="20" r="2.5" />
    </svg>
  );
}
