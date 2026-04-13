import React from "react";

/**
 * Glassmorphism vertical divider for sidebar separation.
 * Usage: Place <SidebarDivider /> between Sidebar and main content.
 */
export function SidebarDivider() {
  return (
    <div
      className="hidden md:block h-full w-[4px] mx-0 bg-white/30 rounded-full backdrop-blur-md shadow-[0_0_32px_0_rgba(255,255,255,0.18)]"
      aria-hidden="true"
      style={{
        zIndex: 50,
        position: 'relative',
      }}
    />
  );
}
