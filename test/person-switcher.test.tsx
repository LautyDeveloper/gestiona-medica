import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PersonSwitcher } from '@/components/person-switcher';
import type { Person, PersonSummary } from '@/lib/models';

const activePerson: Person = {
  id: 'ana',
  name: 'Ana',
  birthDate: '',
  relationship: 'Mamá',
  notes: '',
  archived: false,
};

const people: PersonSummary[] = [
  {
    ...activePerson,
    appointmentCount: 0,
    medicationCount: 0,
    taskCount: 0,
  },
  {
    id: 'abuela',
    name: 'Abuela de prueba',
    birthDate: '',
    relationship: 'Abuela',
    notes: '',
    archived: false,
    appointmentCount: 0,
    medicationCount: 0,
    taskCount: 0,
  },
];

describe('selector de perfil activo', () => {
  it('abre el menú agrupado y permite cambiar de persona', async () => {
    const onSelect = vi.fn();
    render(
      <PersonSwitcher
        activePerson={activePerson}
        people={people}
        onSelect={onSelect}
        onAdd={vi.fn()}
        onManage={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'Perfil activo: Ana',
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByText('Cambiar de persona')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('menuitem', { name: /Abuela de prueba/ }),
    );
    expect(onSelect).toHaveBeenCalledWith('abuela');
  });
});
