import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Menu, X } from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", num: "00" },
  { to: "/skills", label: "Skills Engine", num: "01" },
  { to: "/readiness", label: "AI Readiness", num: "02" },
  { to: "/opportunities", label: "Opportunities", num: "03" },
  { to: "/security", label: "Security", num: "04" },
  { to: "/dashboard", label: "Build", num: "05" },
] as const;

export function Topbar() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-[56px] items-center gap-0 border-b border-border-soft bg-bg-0/90 px-5 backdrop-blur-2xl">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold via-[oklch(0.82_0.16_75)] to-[oklch(0.66_0.14_60)] text-[14px] text-bg-0 shadow-[0_0_12px_oklch(0.770_0.140_75/0.35)]">
            ◈
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-[14px] font-bold tracking-tight text-tx-0">
              TalentGraph
            </span>
            <span className="text-[9px] font-normal uppercase tracking-[0.06em] text-tx-2">
              Africa · Unmapped
            </span>
          </div>
          <span className="ml-2 hidden shrink-0 rounded-[4px] border border-gold-glow bg-gold-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-gold sm:inline-flex">
            WB · CH 05
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "relative flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-[11.5px] font-medium transition-all",
                  active
                    ? "border-gold-glow bg-gold-soft text-gold shadow-[0_0_8px_oklch(0.770_0.140_75/0.15)]"
                    : "text-tx-2 hover:bg-border-soft hover:text-tx-1",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-[18px] w-[18px] items-center justify-center rounded-full font-mono text-[9px] transition-all",
                    active
                      ? "bg-gold text-bg-0 shadow-[0_0_6px_oklch(0.770_0.140_75/0.4)]"
                      : "bg-border",
                  ].join(" ")}
                >
                  {item.num}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-lg border border-teal/30 bg-teal-soft px-2.5 py-1 text-[10px] font-semibold text-teal sm:flex">
            <Shield className="h-3 w-3" />
            <span>Secured</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-tx-1 transition hover:bg-bg-3 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 top-[56px] z-40 bg-bg-0/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-2 p-4">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-[14px] font-medium transition-all",
                    active
                      ? "border-gold-glow bg-gold-soft text-gold"
                      : "border-border-soft bg-bg-3 text-tx-1 hover:border-gold-glow",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px]",
                      active ? "bg-gold text-bg-0" : "bg-bg-4 text-tx-2",
                    ].join(" ")}
                  >
                    {item.num}
                  </span>
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-teal/30 bg-teal-soft px-4 py-3 text-[12px] font-semibold text-teal">
              <Shield className="h-4 w-4" />
              Platform Secured · TLS + CSP + Rate Limiting
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
