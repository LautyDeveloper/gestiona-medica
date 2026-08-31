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
    memberCount: 1,
    personCount: 1,
  },
  members: [
    {
      id: 'u1',
      username: 'ana',
      displayName: 'Ana',
      role: 'admin',
    },
  ],
  persons: [{ id: 'p1', name: 'Elena Pérez', archived: false }],
};

const props = {
  onRename: vi.fn().mockResolvedValue(undefined),
  onCreateUser: vi.fn().mockResolvedValue(undefined),
  onResetPassword: vi.fn().mockResolvedValue(undefined),
  onChangePassword: vi.fn().mockResolvedValue(undefined),
  onAddPerson: vi.fn(),
  onManagePeople: vi.fn(),
};

describe('gestión del grupo familiar', () => {
  it('separa las personas cuidadas de los cuidadores con acceso', () => {
    render(<GroupView data={data} {...props} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Cuidadores con acceso')).toBeInTheDocument();
    expect(screen.getByText('Personas cuidadas')).toBeInTheDocument();
    expect(screen.getByText('Cuidador')).toBeInTheDocument();
    expect(screen.getByText('Elena Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Abuelo')).not.toBeInTheDocument();
  });

  it('permite agregar una persona desde el grupo', async () => {
    const onAddPerson = vi.fn();
    render(<GroupView data={data} {...props} onAddPerson={onAddPerson} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Agregar persona' }),
    );

    expect(onAddPerson).toHaveBeenCalledOnce();
  });

  it('permite al administrador crear un cuidador sin elegir tipo', async () => {
    const temporaryPassword = `test-${crypto.randomUUID()}`;
    const onCreateUser = vi.fn().mockResolvedValue(undefined);
    render(<GroupView data={data} {...props} onCreateUser={onCreateUser} />);
    await userEvent.type(
      screen.getByLabelText('Nombre del nuevo cuidador'),
      'Lucre',
    );
    await userEvent.type(
      screen.getByLabelText('Usuario del nuevo cuidador'),
      'lucre',
    );
    await userEvent.type(
      screen.getByLabelText('Contraseña inicial'),
      temporaryPassword,
    );
    expect(screen.queryByLabelText('Tipo de usuario')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Agregar cuidador' }),
    );
    expect(onCreateUser).toHaveBeenCalledWith({
      username: 'lucre',
      displayName: 'Lucre',
      password: temporaryPassword,
    });
  });

  it('oculta la administración de accesos a un cuidador sin rol admin', () => {
    render(
      <GroupView
        data={{ ...data, group: { ...data.group, role: 'member' } }}
        {...props}
      />,
    );
    expect(screen.queryByText('Agregar cuidador')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Restablecer contraseña'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Mi contraseña')).toBeInTheDocument();
  });
});
