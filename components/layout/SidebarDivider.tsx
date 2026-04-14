import React from "react";

/**
 * Glassmorphism vertical divider for sidebar separation.
 * Usage: Place <SidebarDivider /> between Sidebar and main content.
 */
export function SidebarDivider() {
  // Sidebar already has border-r border-border — this component is kept for
  // layout slot compatibility but renders nothing visible.
  return null;
}
