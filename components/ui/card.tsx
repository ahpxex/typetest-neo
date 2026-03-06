type CardProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function Card({ title, description, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ${className}`}>
      {(title || description) && (
        <header className="mb-4 space-y-1">
          {title ? <h2 className="text-lg font-semibold text-zinc-950">{title}</h2> : null}
          {description ? <p className="text-sm text-zinc-500">{description}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}
