/**
 * Minimal, dependency-free CSV serializer for security findings exports.
 *
 * Two hardening rules beyond RFC 4180 quoting:
 *  - Spreadsheet formula injection: a cell starting with = + - @ (or a control
 *    char that Excel/Sheets strips before parsing) is prefixed with a single
 *    quote so it can never be evaluated as a formula.
 *  - Control characters other than tab are dropped, so a malicious finding
 *    message can't inject raw CR/LF outside a quoted field.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines: string[] = [columns.map((c) => escapeCsvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  }
  // Trailing newline keeps POSIX tools and Excel happy.
  return lines.join("\r\n") + "\r\n";
}

/** Trigger a browser download of `contents` as `filename`. No-op on the server. */
export function downloadCsv(filename: string, contents: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([`\uFEFF${contents}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Safe filename token — used for `findings-<runA>-vs-<runB>.csv`. */
export function safeFileToken(token: string): string {
  return token.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "run";
}
