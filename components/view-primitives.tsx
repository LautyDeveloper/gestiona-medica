import { Button } from '@/components/ui/button';

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
}) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    red: 'bg-red-500/10 text-red-700 dark:text-red-300',
  };
  return (
    <span
      className={`inline-flex rounded-full border border-current/10 px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function FilterBar({
  values,
  active,
  onChange,
}: {
  values: { value: string; label: string; count: number }[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="app-surface flex w-full gap-1 overflow-x-auto rounded-xl p-1 sm:w-fit"
      aria-label="Filtrar lista"
    >
      {values.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={`flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-all ${active === item.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
          aria-pressed={active === item.value}
        >
          {item.label}
          <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[11px]">
            {item.count}
          </span>
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: () => void;
}) {
  return (
    <div className="app-surface col-span-full grid min-h-64 place-items-center rounded-3xl border-dashed p-8 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          {icon}
        </div>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        {action && (
          <Button className="mt-5" onClick={action}>
            Crear ahora
          </Button>
        )}
      </div>
    </div>
  );
}
