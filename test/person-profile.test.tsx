import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from '@/components/person-profile';

describe('onboarding', () => {
  it('valida y crea el primer perfil real', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Onboarding onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana Pérez');
    await userEvent.type(
      screen.getByLabelText(/Fecha de nacimiento/),
      '1980-01-10',
    );
    await userEvent.type(screen.getByLabelText(/Tu vínculo/), 'Madre');
    await userEvent.click(
      screen.getByRole('button', { name: 'Empezar a organizar' }),
    );
    expect(onSave).toHaveBeenCalledWith(
      {
        name: 'Ana Pérez',
        birthDate: '1980-01-10',
        relationship: 'Madre',
        notes: '',
      },
      { enabled: false, username: '', password: '' },
    );
  });

  it('permite crear el perfil con acceso opcional', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Onboarding onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'María');
    await userEvent.type(
      screen.getByLabelText(/Fecha de nacimiento/),
      '1940-05-12',
    );
    await userEvent.type(screen.getByLabelText(/Tu vínculo/), 'Abuela');
    await userEvent.click(screen.getByLabelText('Puede iniciar sesión'));
    await userEvent.type(screen.getByLabelText('Usuario'), 'maria');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura');
    await userEvent.click(
      screen.getByRole('button', { name: 'Empezar a organizar' }),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'María' }),
      {
        enabled: true,
        username: 'maria',
        password: 'clave-segura',
      },
    );
  });
});
