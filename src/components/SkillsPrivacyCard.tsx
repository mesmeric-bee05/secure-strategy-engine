import { useState } from "react";
import { ChevronDown, Copy, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  DRAFT_MAP_KEY,
  LANG_MAP_KEY,
} from "@/lib/skills-drafts";

const RESTORED_BANNER_KEY = "talentgraph:skills:restored-banner-dismissed";
const LAST_ERROR_KEY = "talentgraph:last-error"; // session-scoped, see last-error.ts

interface StorageReportEntry {
  key: string;
  scope: "localStorage" | "sessionStorage";
  bytes: number;
  exists: boolean;
}

function buildStorageReport(): StorageReportEntry[] {
  const safeBytes = (storage: Storage, key: string): StorageReportEntry => {
    if (typeof window === "undefined") {
      return { key, scope: "localStorage", bytes: 0, exists: false };
    }
    try {
      const raw = storage.getItem(key);
      return {
        key,
        scope: storage === window.localStorage ? "localStorage" : "sessionStorage",
        bytes: raw ? new Blob([raw]).size : 0,
        exists: raw !== null,
      };
    } catch {
      return {
        key,
        scope: storage === window.localStorage ? "localStorage" : "sessionStorage",
        bytes: 0,
        exists: false,
      };
    }
  };
  if (typeof window === "undefined") return [];
  return [
    safeBytes(window.localStorage, DRAFT_MAP_KEY),
    safeBytes(window.localStorage, LANG_MAP_KEY),
    safeBytes(window.sessionStorage, RESTORED_BANNER_KEY),
    safeBytes(window.sessionStorage, LAST_ERROR_KEY),
  ];
}

/**
 * Static, accessible privacy/security checklist explaining where /skills data
 * lives, what is sent over the network, and how to recover from quota or
 * private-mode failures. Includes a "Copy storage report" affordance for
 * support requests.
 */
export function SkillsPrivacyCard() {
  const [open, setOpen] = useState(false);

  async function copyReport() {
    try {
      const report = {
        generatedAt: new Date().toISOString(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
        entries: buildStorageReport(),
      };
      const text = JSON.stringify(report, null, 2);
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Storage report copied to clipboard");
      } else {
        toast.error("Clipboard not available — open DevTools to inspect storage");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? `Could not copy: ${e.message}` : "Copy failed"
      );
    }
  }

  return (
    <section
      aria-labelledby="privacy-card-title"
      className="mt-6 overflow-hidden rounded-2xl border border-border-soft bg-bg-3"
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        aria-controls="privacy-card-body"
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-bg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow"
      >
        <span className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-teal" aria-hidden="true" />
          <span className="flex flex-col">
            <span
              id="privacy-card-title"
              className="font-display text-[13px] font-semibold text-tx-0"
            >
              Where your data lives
            </span>
            <span className="text-[10.5px] text-tx-2">
              Storage scopes, network behaviour, and what to do if saving fails
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-tx-2 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="privacy-card-body"
          className="border-t border-border-soft px-5 py-4 text-[12px] leading-relaxed text-tx-1"
        >
          <ol className="space-y-3">
            <li>
              <p className="mb-1 flex items-center gap-2 font-semibold text-tx-0">
                <Lock className="h-3 w-3 text-gold" aria-hidden="true" />
                Stored on this device only
              </p>
              <ul className="ml-5 list-disc space-y-1 text-tx-2">
                <li>
                  Drafts (per persona) →{" "}
                  <code className="font-mono text-[10.5px] text-tx-1">
                    {DRAFT_MAP_KEY}
                  </code>{" "}
                  in <strong>localStorage</strong>
                </li>
                <li>
                  Recognition language (per persona) →{" "}
                  <code className="font-mono text-[10.5px] text-tx-1">
                    {LANG_MAP_KEY}
                  </code>{" "}
                  in <strong>localStorage</strong>
                </li>
                <li>
                  Restored-banner dismissal →{" "}
                  <code className="font-mono text-[10.5px] text-tx-1">
                    {RESTORED_BANNER_KEY}
                  </code>{" "}
                  in <strong>sessionStorage</strong> (clears when the tab closes)
                </li>
                <li>
                  Last client error →{" "}
                  <code className="font-mono text-[10.5px] text-tx-1">
                    {LAST_ERROR_KEY}
                  </code>{" "}
                  in <strong>sessionStorage</strong>, auto-expires after 24h
                </li>
              </ul>
            </li>

            <li>
              <p className="mb-1 font-semibold text-tx-0">
                Sent to the server only when you click "Map to ISCO-08 / ESCO"
              </p>
              <p className="text-tx-2">
                Your draft text and chosen language are sent for AI mapping.
                Nothing is uploaded automatically while you type or switch
                personas. The Speech Recognition API runs in the browser using
                the device microphone — audio never leaves your machine.
              </p>
            </li>

            <li>
              <p className="mb-1 font-semibold text-tx-0">
                What to do if saving fails
              </p>
              <ul className="ml-5 list-disc space-y-1 text-tx-2">
                <li>
                  <strong className="text-tx-1">Quota exceeded:</strong> click
                  Export to back up first, then delete drafts you no longer
                  need. Saving auto-retries the moment you free space.
                </li>
                <li>
                  <strong className="text-tx-1">Private / Incognito mode:</strong>{" "}
                  some browsers disable persistent storage. Your draft still
                  works in this tab but won't survive a refresh — Export
                  before closing.
                </li>
                <li>
                  <strong className="text-tx-1">Site-data cleared:</strong>{" "}
                  re-import your most recent JSON backup with the Import
                  button.
                </li>
              </ul>
            </li>

            <li>
              <p className="mb-1 font-semibold text-tx-0">Audit trail</p>
              <p className="text-tx-2">
                Server-side errors and AI extraction calls are appended to an
                immutable audit log on the backend. Local errors are summarised
                in the "Last error" panel above and never include your draft
                text.
              </p>
            </li>
          </ol>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-soft pt-3">
            <p className="text-[10.5px] text-tx-2">
              Generate a JSON snapshot of your local storage usage for a
              support request.
            </p>
            <button
              type="button"
              onClick={copyReport}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-bg-2 px-3 py-1.5 text-[11px] text-tx-1 transition hover:border-gold-glow hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow"
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
              Copy storage report
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
