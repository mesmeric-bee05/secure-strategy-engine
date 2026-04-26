import { Link } from "@tanstack/react-router";
import { Shield, Lock, Globe2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border-soft bg-bg-1/50">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-[oklch(0.66_0.14_60)] text-[12px] text-bg-0">
                ◈
              </div>
              <span className="font-display text-[13px] font-bold text-tx-0">
                TalentGraph Africa
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-tx-2">
              Making 600 million informal workers visible to the global economy through AI-powered
              skill mapping and cryptographic credentials.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-tx-2">
              Modules
            </h4>
            <nav className="flex flex-col gap-1.5">
              <Link to="/skills" className="text-[11px] text-tx-1 transition hover:text-gold">
                Skills Signal Engine
              </Link>
              <Link to="/readiness" className="text-[11px] text-tx-1 transition hover:text-gold">
                AI Readiness Lens
              </Link>
              <Link
                to="/opportunities"
                className="text-[11px] text-tx-1 transition hover:text-gold"
              >
                Opportunity Dashboard
              </Link>
            </nav>
          </div>

          <div>
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-tx-2">
              Data Sources
            </h4>
            <nav className="flex flex-col gap-1.5">
              <span className="text-[11px] text-tx-1">ILO ILOSTAT 2023</span>
              <span className="text-[11px] text-tx-1">World Bank WDI/HCI</span>
              <span className="text-[11px] text-tx-1">ISCO-08 / ESCO v1.1</span>
              <span className="text-[11px] text-tx-1">Frey & Osborne (2013)</span>
            </nav>
          </div>

          <div>
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-tx-2">
              Security
            </h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[11px] text-tx-1">
                <Shield className="h-3 w-3 text-teal" />
                End-to-end encryption
              </div>
              <div className="flex items-center gap-2 text-[11px] text-tx-1">
                <Lock className="h-3 w-3 text-teal" />
                ECDSA credential signing
              </div>
              <div className="flex items-center gap-2 text-[11px] text-tx-1">
                <Globe2 className="h-3 w-3 text-teal" />
                SOC 2 ready architecture
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border-soft pt-6">
          <p className="text-[10px] text-tx-2">
            &copy; {new Date().getFullYear()} TalentGraph Africa — World Bank Challenge 05 ·
            UNMAPPED. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-teal/30 bg-teal-soft px-2.5 py-0.5 text-[9px] font-bold text-teal">
              CSP Enforced
            </span>
            <span className="rounded-full border border-gold/30 bg-gold-soft px-2.5 py-0.5 text-[9px] font-bold text-gold">
              Rate Limited
            </span>
            <span className="rounded-full border border-lavender/30 bg-lavender-soft px-2.5 py-0.5 text-[9px] font-bold text-lavender">
              HSTS Enabled
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
