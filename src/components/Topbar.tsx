import { Link, useLocation } from "@tanstack/react-router";
import { Wifi } from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", num: "00" },
  { to: "/skills", label: "Skills Engine", num: "01" },
  { to: "/readiness", label: "AI Readiness", num: "02" },
  { to: "/opportunities", label: "Opportunities", num: "03" },
] as const;

export function Topbar() {
  const { pathname } = useLocation();

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[52px] items-center gap-0 border-b border-border-soft bg-bg-0/92 px-5 backdrop-blur-xl">
      <Link to="/" className="flex shrink-0 items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-gradient-to-br from-gold to-[oklch(0.66_0.14_60)] text-[13px] text-bg-0">
          ◈
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display text-[13px] font-bold tracking-tight text-tx-0">
            TalentGraph
          </span>
          <span className="text-[9px] font-normal uppercase tracking-[0.06em] text-tx-2">
            Africa · Unmapped
          </span>
        </div>
        <span className="ml-2 shrink-0 rounded-[4px] border border-gold-glow bg-gold-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-gold">
          WB · CH 05
        </span>
      </Link>

      <nav className="ml-4 flex items-center gap-px">
        {NAV.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={[
                "flex items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-[11.5px] font-medium transition-all",
                active
                  ? "border-gold-glow bg-gold-soft text-gold"
                  : "text-tx-2 hover:bg-border-soft hover:text-tx-1",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-[17px] w-[17px] items-center justify-center rounded-full font-mono text-[9px]",
                  active ? "bg-gold text-bg-0" : "bg-border",
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
        <button className="flex items-center gap-1.5 rounded-md border border-border bg-white/5 px-2.5 py-1.5 text-[11.5px] font-medium text-tx-0 transition-all hover:border-gold-glow hover:bg-gold-soft">
          <span className="text-[14px]">🇰🇪</span>
          <span>Kenya</span>
          <span className="text-[9px] text-tx-2">▾</span>
        </button>
        <button className="hidden items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-[10.5px] text-tx-2 transition-all hover:border-border-strong hover:text-tx-1 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-teal" />
          <Wifi className="h-3 w-3" />
          High BW
        </button>
      </div>
    </header>
  );
}
