#!/usr/bin/env bun
/**
 * Renders reports/*.json into a single reports/index.html summary.
 * Consumed by the security-nightly workflow's artifact upload.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const REPORTS = resolve(process.cwd(), "reports");
if (!existsSync(REPORTS)) mkdirSync(REPORTS, { recursive: true });

const files = readdirSync(REPORTS).filter((f) => f.endsWith(".json"));
const sections = files.map((f) => {
  let body = "";
  try {
    const parsed = JSON.parse(readFileSync(join(REPORTS, f), "utf8"));
    body = `<pre>${escape(JSON.stringify(parsed, null, 2))}</pre>`;
  } catch (e) {
    body = `<pre>failed to parse: ${escape(String(e))}</pre>`;
  }
  return `<section><h2>${escape(f)}</h2>${body}</section>`;
});

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Security nightly report</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#111}
  h1{border-bottom:1px solid #ddd;padding-bottom:.5rem}
  section{margin:1.5rem 0;padding:1rem;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa}
  pre{white-space:pre-wrap;word-break:break-word;background:#111;color:#e5e5e5;padding:1rem;border-radius:6px;overflow:auto}
</style></head>
<body>
  <h1>Security nightly report</h1>
  <p>Generated ${new Date().toISOString()}</p>
  ${sections.join("\n") || "<p>No JSON reports found.</p>"}
</body></html>`;

writeFileSync(join(REPORTS, "index.html"), html);
console.log(`[render-security-report] wrote ${join(REPORTS, "index.html")}`);
