#!/usr/bin/env bun
/**
 * Posts a Slack-compatible notification when the security-memory drift gate
 * changes state, using `reports/security-memory-drift.json`.
 *
 * Configuration: `SECURITY_DRIFT_WEBHOOK_URL` (optional). When absent the
 * notification is skipped and the exit code stays 0 — the gate itself is what
 * fails the build. The URL is never printed.
 *
 * Usage: bun scripts/security/notify-drift.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface DriftReport {
  status: "ok" | "drift";
  driftScore: number;
  driftedFiles: Array<{ file: string; reason: string; changedKeys: string[] }>;
  repo?: string | null;
  runId?: string | null;
  sha?: string | null;
  prNumber?: string | null;
  generatedAt?: string;
}

export interface SlackPayload {
  text: string;
  blocks: Array<Record<string, unknown>>;
}

export function links(report: DriftReport) {
  const repo = report.repo ?? "";
  const base = repo ? `https://github.com/${repo}` : "";
  return {
    run: report.runId && base ? `${base}/actions/runs/${report.runId}` : null,
    artifacts: report.runId && base ? `${base}/actions/runs/${report.runId}#artifacts` : null,
    diff:
      report.prNumber && base
        ? `${base}/pull/${report.prNumber}/files`
        : report.sha && base
          ? `${base}/commit/${report.sha}`
          : null,
  };
}

export function buildPayload(report: DriftReport): SlackPayload {
  const l = links(report);
  const failed = report.status === "drift";
  const title = failed
    ? ":warning: Security memory drift gate FAILED"
    : ":white_check_mark: Security memory drift gate recovered";
  const linkLine = [
    l.run ? `<${l.run}|workflow run>` : null,
    l.artifacts ? `<${l.artifacts}|artifacts>` : null,
    l.diff ? `<${l.diff}|diff>` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const fileLines = report.driftedFiles.length
    ? report.driftedFiles
        .map(
          (d) =>
            `• \`${d.file}\` — ${d.reason}${
              d.changedKeys.length ? `\n   keys: ${d.changedKeys.map((k) => `\`${k}\``).join(", ")}` : ""
            }`,
        )
        .join("\n")
    : "_no drifted files_";

  const summary =
    `${title}\n` +
    `repo: ${report.repo ?? "unknown"} · run: ${report.runId ?? "unknown"}` +
    `${report.prNumber ? ` · PR #${report.prNumber}` : ""} · drift score: ${report.driftScore}`;

  return {
    text: summary,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${title}*` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Repo*\n${report.repo ?? "unknown"}` },
          { type: "mrkdwn", text: `*Run*\n${report.runId ?? "unknown"}` },
          { type: "mrkdwn", text: `*PR*\n${report.prNumber ? `#${report.prNumber}` : "n/a"}` },
          { type: "mrkdwn", text: `*Drift score*\n${report.driftScore}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: fileLines.slice(0, 2800) } },
      ...(linkLine ? [{ type: "context", elements: [{ type: "mrkdwn", text: linkLine }] }] : []),
    ],
  };
}

export function readReport(path = resolve(process.cwd(), "reports/security-memory-drift.json")) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as DriftReport;
}

async function main() {
  const webhook = process.env.SECURITY_DRIFT_WEBHOOK_URL;
  const report = readReport();
  if (!report) {
    console.log("[notify-drift] no drift report found; nothing to notify");
    return;
  }
  if (!webhook) {
    console.log("[notify-drift] SECURITY_DRIFT_WEBHOOK_URL not configured; skipping notification");
    return;
  }
  // Only notify on failure, or on recovery for a PR (avoids per-push noise).
  if (report.status === "ok" && !report.prNumber) {
    console.log("[notify-drift] gate passed outside a PR; skipping notification");
    return;
  }

  const resp = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildPayload(report)),
  });
  if (!resp.ok) {
    console.error(`[notify-drift] webhook failed [${resp.status}]: ${await resp.text()}`);
    return;
  }
  console.log(`[notify-drift] notified (status=${report.status}, score=${report.driftScore})`);
}

if (import.meta.main) {
  await main();
}
