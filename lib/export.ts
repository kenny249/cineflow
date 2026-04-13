// ─── Export utilities ─────────────────────────────────────────────────────────
// CSV and print-to-PDF helpers — no external dependencies required.

/** Download a CSV file from rows of data. */
export function downloadCSV(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
  const escape = (val: string | number | undefined | null): string => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Open a print dialog with a clean HTML table — functions as "Export to PDF" via browser print. */
export function printTable(opts: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | undefined | null)[][];
  filename?: string;
}): void {
  const { title, subtitle, headers, rows } = opts;
  const thCells = headers.map((h) => `<th style="border:1px solid #ccc;padding:8px 12px;background:#f5f5f5;font-weight:600;text-align:left;white-space:nowrap">${h}</th>`).join("");
  const trRows = rows.map((row) => {
    const tds = row.map((cell) => `<td style="border:1px solid #e5e5e5;padding:8px 12px;font-size:13px">${cell ?? ""}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; margin: 0; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p.sub { font-size: 13px; color: #666; margin: 0 0 20px; }
    table { border-collapse: collapse; width: 100%; }
    tr:nth-child(even) td { background: #fafafa; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
  <table>
    <thead><tr>${thCells}</tr></thead>
    <tbody>${trRows}</tbody>
  </table>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
}
