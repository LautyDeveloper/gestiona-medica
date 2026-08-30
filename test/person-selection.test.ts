import { describe, expect, it } from 'vitest';
import { chooseActivePerson } from '@/lib/person-selection';
import type { PersonSummary } from '@/lib/models';

const people: PersonSummary[] = [
  {
    id: '1',
    name: 'Ana',
    birthDate: '',
    relationship: '',
    notes: '',
    archived: false,
    appointmentCount: 0,
    medicationCount: 0,
    taskCount: 0,
  },
  {
    id: '2',
    name: 'Luis',
    birthDate: '',
    relationship: '',
    notes: '',
    archived: true,
    appointmentCount: 1,
    medicationCount: 2,
    taskCount: 3,
  },
  {
    id: '3',
    name: 'Marta',
    birthDate: '',
    relationship: '',
    notes: '',
    archived: false,
    appointmentCount: 0,
    medicationCount: 0,
    taskCount: 0,
  },
];

describe('selección de persona activa', () => {
  it('restaura una preferencia válida', () =>
    expect(chooseActivePerson(people, '3')?.id).toBe('3'));
  it('ignora una preferencia archivada o inexistente', () => {
    expect(chooseActivePerson(people, '2')?.id).toBe('1');
    expect(chooseActivePerson(people, 'missing')?.id).toBe('1');
  });
  it('devuelve null cuando todos están archivados', () =>
    expect(
      chooseActivePerson(
        people.map((person) => ({ ...person, archived: true })),
        '1',
      ),
    ).toBeNull());
});
