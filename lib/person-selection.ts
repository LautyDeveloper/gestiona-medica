import type { PersonSummary } from '@/lib/models';

export function chooseActivePerson(
  people: PersonSummary[],
  preferredId?: string | null,
) {
  const active = people.filter((person) => !person.archived);
  return (
    active.find((person) => person.id === preferredId) || active[0] || null
  );
}
