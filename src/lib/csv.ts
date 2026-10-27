/** CSV text encoding only; contains no database access or export endpoint. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvDocument(columns: string[], rows: unknown[][]): string {
  return "\uFEFF" + [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
