export function SectionEyebrow({
  module,
  children,
}: {
  module: string;
  children: React.ReactNode;
}) {
  return (
    <div className="eyebrow mb-2 flex items-center gap-2">
      <span className="font-mono text-tx-2">{module}</span>
      <span className="h-px w-6 bg-gold/60" />
      <span>{children}</span>
    </div>
  );
}

export function PageTitle({
  eyebrow,
  module,
  children,
  description,
}: {
  eyebrow?: string;
  module?: string;
  children: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {eyebrow && module ? (
        <SectionEyebrow module={module}>{eyebrow}</SectionEyebrow>
      ) : null}
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-tx-0 md:text-[32px]">
        {children}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-tx-1">
          {description}
        </p>
      ) : null}
    </header>
  );
}
