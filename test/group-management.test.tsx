import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GroupOnboarding, GroupView } from '@/components/group-management';
import type { GroupData } from '@/lib/models';

const data: GroupData = {
  group: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Familia Pérez',
    role: 'admin',
    memberCount: 2,
    personCount: 1,
  },
  members: [
    {
      id: 'u1',
      username: 'ana',
      displayName: 'Ana',
      email: 'ana@example.com',
      role: 'admin',
    },
    {
      id: 'u2',
      username: 'luis',
      displayName: 'Luis',
      email: 'luis@example.com',
      role: 'member',
    },
  ],
  invitations: [
    {
      id: 'i1',
      status: 'pending',
      expiresAt: '2026-09-06T00:00:00.000Z',
      createdByName: 'Ana',
    },
  ],
  persons: [{ id: 'p1', name: 'Elena Pérez', archived: false }],
};

describe('gestión del grupo familiar', () => {
  it('crea el primer grupo desde el onboarding', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    render(<GroupOnboarding onCreate={create} />);
    await userEvent.type(
      screen.getByLabelText('Nombre del grupo'),
      'Familia Pérez',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }));
    expect(create).toHaveBeenCalledWith('Familia Pérez');
  });

  it('muestra integrantes, roles e invitaciones al administrador', () => {
    render(
      <GroupView
        data={data}
        inviteUrl=""
        onCreateInvite={vi.fn()}
        onCopy={vi.fn()}
        onRevoke={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
    expect(screen.getByText('Elena Pérez')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Crear invitación' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revocar' })).toBeInTheDocument();
  });

  it('oculta las acciones administrativas a un miembro', () => {
    render(
      <GroupView
        data={{ ...data, group: { ...data.group, role: 'member' } }}
        inviteUrl=""
        onCreateInvite={vi.fn()}
        onCopy={vi.fn()}
        onRevoke={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Crear invitación' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Sólo un administrador/)).toBeInTheDocument();
  });
});
