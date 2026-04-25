export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-3.5 overflow-y-auto border-r border-border-soft bg-bg-1/70 p-4 lg:flex">
      <SidebarSection label="Country signals · Kenya">
        <Stat name="Youth unemployment (15–24)" value="13.4%" tone="coral" />
        <Stat name="Min wage (monthly)" value="$120" tone="gold" />
        <Stat name="Informal employment" value="83.6%" tone="lav" />
        <Stat name="Human Capital Index" value="0.55" tone="teal" />
        <p className="mt-1.5 text-[8.5px] italic text-tx-2">
          Sources: ILO ILOSTAT 2023, World Bank HCI 2020
        </p>
      </SidebarSection>

      <SidebarSection label="Demo personas">
        <Persona emoji="🧵" name="Sarah, 22" sub="Seamstress · Eldoret, KE" active />
        <Persona emoji="📱" name="James, 28" sub="Phone repair · Nairobi" />
        <Persona emoji="🌾" name="Amara, 34" sub="Farmer · Kano, NG" />
        <Persona emoji="🛒" name="Kwame, 26" sub="Trader · Accra, GH" />
      </SidebarSection>

      <SidebarSection label="Data sources">
        <p className="text-[10px] leading-relaxed text-tx-1">
          Frey & Osborne (2013) · ILO ILOSTAT · World Bank WDI · World Bank HCI ·
          Wittgenstein Centre SSP2 · ISCO-08 · ESCO v1.1
        </p>
      </SidebarSection>
    </aside>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border-soft bg-bg-3 p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-tx-2">
        <span>{label}</span>
        <span className="h-px flex-1 bg-border-soft" />
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Stat({
  name,
  value,
  tone,
}: {
  name: string;
  value: string;
  tone: "gold" | "teal" | "coral" | "lav";
}) {
  const color =
    tone === "gold"
      ? "text-gold"
      : tone === "teal"
        ? "text-teal"
        : tone === "coral"
          ? "text-coral"
          : "text-lavender";
  return (
    <div className="flex items-start justify-between border-b border-border-soft py-1.5 last:border-b-0">
      <span className="max-w-[130px] text-[11px] leading-tight text-tx-1">{name}</span>
      <span className={`font-mono text-[12px] font-bold ${color}`}>{value}</span>
    </div>
  );
}

function Persona({
  emoji,
  name,
  sub,
  active,
}: {
  emoji: string;
  name: string;
  sub: string;
  active?: boolean;
}) {
  return (
    <button
      className={[
        "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-all",
        active
          ? "border-gold bg-gold-soft"
          : "border-border-soft bg-bg-4 hover:border-gold-glow hover:bg-gold-soft",
      ].join(" ")}
    >
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-bg-2 text-[13px]">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-tx-0">{name}</span>
        <span className="block text-[10px] leading-tight text-tx-2">{sub}</span>
      </span>
    </button>
  );
}
