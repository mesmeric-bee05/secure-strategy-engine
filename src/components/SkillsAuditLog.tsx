import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Download, RotateCw, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  type AuditEvent,
  type AuditEventKind,
  clearAuditLog,
  readAuditLog,
  subscribeAuditLog,
} from "@/lib/skills-audit";

const KIND_LABEL: Record<AuditEventKind, string> = {
  import: "Import",
  import_rejected: "Import rejected",
  export: "Export",
  data_download: "Download",
  quota_blocked: "Quota blocked",
  privacy_blocked: "Privacy blocked",
};

const KIND_TONE: Record<AuditEventKind, string> = {
  import: "bg-teal-soft text-teal border-teal/30",
  import_rejected: "bg-coral-soft/40 text-coral border-coral/40",
  export: "bg-gold-soft text-gold border-gold-glow",
  data_download: "bg-bg-2 text-tx-1 border-border-strong",
  quota_blocked: "bg-coral-soft/40 text-coral border-coral/40",
  privacy_blocked: "bg-coral-soft/40 text-coral border-coral/40",
};

function relTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Math.max(0, now - t);
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

/**
 * Collapsible, accessible viewer for the per-device audit log.
 * Reads through `readAuditLog()` and re-renders on `subscribeAuditLog`.
 */
export function SkillsAuditLog() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>(() => readAuditLog());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    return subscribeAuditLog(() => setEvents(readAuditLog()));
  }, []);

  // Refresh relative timestamps once a minute while open.
  useEffect(() => {
    if (!open) return;
    const handle = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(handle);
  }, [open]);

  const memoryWarning = useMemo(() => events.some((e) => e.scope === "memory"), [events]);

  function refresh() {
    setEvents(readAuditLog());
    setNow(Date.now());
  }

  function onClear() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Clear the local activity log? This cannot be undone.")
    ) {
      return;
    }
    clearAuditLog();
    setEvents([]);
    toast.success("Activity log cleared");
  }

  function onDownload() {
    try {
      const payload = {
        generatedAt: new Date().toISOString(),
        app: "TalentGraph Africa — Skills",
        kind: "skills.activity-log.v1",
        events,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `talentgraph-skills-activity-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Activity log downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? `Download failed: ${e.message}` : "Download failed");
    }
  }

  return (
    <section
      id="skills-audit-log"
      aria-labelledby="audit-log-title"
      className="mt-4 overflow-hidden rounded-2xl border border-border-soft bg-bg-3"
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        aria-controls="audit-log-body"
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-bg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow"
      >
        <span className="flex items-center gap-2.5">
          <ScrollText className="h-4 w-4 text-gold" aria-hidden="true" />
          <span className="flex flex-col">
            <span id="audit-log-title" className="font-display text-[13px] font-semibold text-tx-0">
              Local activity log
            </span>
            <span className="text-[10.5px] text-tx-2">
              Imports, exports, and storage warnings recorded on this device
              {events.length > 0
                ? ` · ${events.length} entr${events.length === 1 ? "y" : "ies"}`
                : ""}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-tx-2 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id="audit-log-body" className="border-t border-border-soft px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-2 px-2.5 py-1 text-[10.5px] text-tx-1 transition hover:border-gold-glow hover:text-gold"
            >
              <RotateCw className="h-3 w-3" aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={events.length === 0}
              className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-2 px-2.5 py-1 text-[10.5px] text-tx-1 transition hover:border-gold-glow hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              Download log
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={events.length === 0}
              className="inline-flex items-center gap-1 rounded-md border border-coral/40 bg-coral-soft/20 px-2.5 py-1 text-[10.5px] text-coral transition hover:bg-coral-soft/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              Clear log
            </button>
          </div>

          {memoryWarning && (
            <p
              role="status"
              className="mb-2 flex items-start gap-2 rounded-md border border-coral/40 bg-coral-soft/20 px-3 py-2 text-[11px] text-coral"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              Some entries are kept only in memory and will disappear when you close this tab — your
              browser is blocking persistent storage.
            </p>
          )}

          {events.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-soft bg-bg-2 px-4 py-6 text-center text-[11.5px] text-tx-2">
              Nothing here yet. Imports, exports, and storage warnings will appear here.
            </p>
          ) : (
            <ol className="divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-1 bg-bg-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span
                    className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${KIND_TONE[e.kind]}`}
                  >
                    {KIND_LABEL[e.kind]}
                  </span>
                  <span className="flex-1 text-[11.5px] text-tx-0">
                    {e.summary}
                    {e.detail?.filename && (
                      <span className="ml-1 font-mono text-[10px] text-tx-2">
                        · {e.detail.filename}
                      </span>
                    )}
                  </span>
                  <span
                    className="font-mono text-[10px] text-tx-2"
                    title={`${e.at} · stored in ${e.scope}`}
                  >
                    {relTime(e.at, now)}
                    {e.scope === "memory" && <span className="ml-1 text-coral">· memory</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
