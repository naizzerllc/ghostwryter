export const SectionHeader = ({ title }: { title: string }) => (
  <div className="mb-4">
    <h2 className="text-xs font-mono uppercase tracking-[0.75em] text-foreground border-b-2 border-primary pb-1 inline-block">
      {title}
    </h2>
  </div>
);
