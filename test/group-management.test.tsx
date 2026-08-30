import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GroupView } from '@/components/group-management';
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
      userType: 'caregiver',
      role: 'admin',
    },
    {
      id: 'u2',
      username: 'luis',
      displayName: 'Luis',
      userType: 'elder',
      role: 'member',
    },
  ],
  persons: [{ id: 'p1', name: 'Elena Pérez', archived: false }],
};

const props = {
  onRename: vi.fn().mockResolvedValue(undefined),
  onCreateUser: vi.fn().mockResolvedValue(undefined),
  onResetPassword: vi.fn().mockResolvedValue(undefined),
  onChangePassword: vi.fn().mockResolvedValue(undefined),
};

describe('gestión del grupo familiar', () => {
  it('muestra integrantes, tipos y personas asociadas', () => {
    render(<GroupView data={data} {...props} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
    expect(screen.getAllByText('Cuidador').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Abuelo').length).toBeGreaterThan(0);
    expect(screen.getByText('Elena Pérez')).toBeInTheDocument();
  });

  it('permite al cuidador crear un usuario', async () => {
    const temporaryPassword = `test-${crypto.randomUUID()}`;
    const onCreateUser = vi.fn().mockResolvedValue(undefined);
    render(<GroupView data={data} {...props} onCreateUser={onCreateUser} />);
    await userEvent.type(
      screen.getByLabelText('Nombre del nuevo integrante'),
      'Lucre',
    );
    await userEvent.type(
      screen.getByLabelText('Usuario del nuevo integrante'),
      'lucre',
    );
    await userEvent.type(
      screen.getByLabelText('Contraseña inicial'),
      temporaryPassword,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear acceso' }));
    expect(onCreateUser).toHaveBeenCalledWith({
      username: 'lucre',
      displayName: 'Lucre',
      userType: 'elder',
      password: temporaryPassword,
    });
  });

  it('oculta administración de usuarios a un abuelo', () => {
    render(
      <GroupView
        data={{ ...data, group: { ...data.group, role: 'member' } }}
        {...props}
      />,
    );
    expect(screen.queryByText('Crear usuario')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Restablecer contraseña'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Mi contraseña')).toBeInTheDocument();
  });
});
