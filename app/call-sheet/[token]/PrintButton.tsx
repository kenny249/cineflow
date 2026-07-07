"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        fontSize: 11,
        color: "#71717a",
        cursor: "pointer",
        background: "none",
        border: "1px solid #e4e4e7",
        borderRadius: 6,
        padding: "4px 12px",
      }}
    >
      Print / Save PDF
    </button>
  );
}
