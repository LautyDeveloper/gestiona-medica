export function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC', ...options }).format(new Date(`${date}T12:00:00Z`));
}

export function formatLongDate(date: string) {
  return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function dueLabel(date: string) {
  if (!date) return 'Sin fecha límite';
  return formatDate(date);
}
