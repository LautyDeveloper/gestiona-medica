import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PeopleManagerDialog } from '@/components/person-profile';
import type { PersonSummary } from '@/lib/models';

const people: PersonSummary[] = [
  {
    id: '1',
    name: 'Ana',
    birthDate: '1980-01-01',
    relationship: 'Abuela',
    notes: '',
    archived: false,
    appointmentCount: 2,
    medicationCount: 1,
    taskCount: 0,
  },
  {
    id: '2',
    name: 'Luis',
    birthDate: '1978-01-01',
    relationship: 'Abuelo',
    notes: '',
    archived: true,
    appointmentCount: 1,
    medicationCount: 0,
    taskCount: 0,
  },
];

describe('administración de personas', () => {
  it('separa perfiles activos y archivados sin ofrecer eliminación', async () => {
    const onArchive = vi.fn();
    const onRestore = vi.fn();
    render(
      <PeopleManagerDialog
        people={people}
        open
        onOpenChange={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onArchive={onArchive}
        onRestore={onRestore}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Eliminar/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(onArchive).toHaveBeenCalledWith(people[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(onRestore).toHaveBeenCalledWith(people[1]);
  });
});
