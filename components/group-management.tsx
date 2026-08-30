'use client';

import { KeyRound, ShieldCheck, UserPlus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { GroupData, UserType } from '@/lib/models';

export type NewUserPayload = {
  username: string;
  displayName: string;
  userType: UserType;
  password: string;
};

export function GroupView({
  data,
  onRename,
  onCreateUser,
  onResetPassword,
  onChangePassword,
}: {
  data: GroupData;
  onRename: (name: string) => Promise<void>;
  onCreateUser: (payload: NewUserPayload) => Promise<void>;
  onResetPassword: (userId: string, password: string) => Promise<void>;
  onChangePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
}) {
  const admin = data.group.role === 'admin';
  const [name, setName] = useState(data.group.name);
  const [newUser, setNewUser] = useState<NewUserPayload>({
    username: '',
    displayName: '',
    userType: 'elder',
    password: '',
  });
  const [resetUserId, setResetUserId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>, after?: () => void) {
    setBusy(true);
    setError('');
    try {
      await action();
      after?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive lg:col-span-2"
        >
          {error}
        </p>
      )}
      {admin && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nombre del grupo</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              aria-label="Nombre del grupo familiar"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              disabled={busy || !name.trim() || name.trim() === data.group.name}
              onClick={() => void run(() => onRename(name))}
            >
              Guardar
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Integrantes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.members.map((member) => (
            <div key={member.id} className="rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <UserRound className="text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{member.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{member.username}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-1 text-xs">
                  {member.userType === 'caregiver' ? 'Cuidador' : 'Abuelo'}
                </span>
              </div>
              {admin && (
                <Button
                  className="mt-3"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResetUserId(member.id);
                    setResetPassword('');
                  }}
                >
                  <KeyRound /> Restablecer contraseña
                </Button>
              )}
              {resetUserId === member.id && (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(
                      () => onResetPassword(member.id, resetPassword),
                      () => {
                        setResetUserId('');
                        setResetPassword('');
                      },
                    );
                  }}
                >
                  <Input
                    aria-label={`Nueva contraseña para ${member.displayName}`}
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    placeholder="Contraseña temporal"
                  />
                  <Button type="submit" disabled={busy}>
                    Guardar
                  </Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      {admin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" /> Crear usuario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => onCreateUser(newUser),
                  () =>
                    setNewUser({
                      username: '',
                      displayName: '',
                      userType: 'elder',
                      password: '',
                    }),
                );
              }}
            >
              <Input
                aria-label="Nombre del nuevo integrante"
                required
                maxLength={120}
                placeholder="Nombre"
                value={newUser.displayName}
                onChange={(event) =>
                  setNewUser((value) => ({
                    ...value,
                    displayName: event.target.value,
                  }))
                }
              />
              <Input
                aria-label="Usuario del nuevo integrante"
                required
                minLength={2}
                maxLength={40}
                placeholder="Usuario"
                value={newUser.username}
                onChange={(event) =>
                  setNewUser((value) => ({
                    ...value,
                    username: event.target.value,
                  }))
                }
              />
              <select
                aria-label="Tipo de usuario"
                className="h-10 rounded-xl border bg-card px-3 text-sm"
                value={newUser.userType}
                onChange={(event) =>
                  setNewUser((value) => ({
                    ...value,
                    userType: event.target.value as UserType,
                  }))
                }
              >
                <option value="elder">Abuelo</option>
                <option value="caregiver">Cuidador</option>
              </select>
              <Input
                aria-label="Contraseña inicial"
                required
                type="password"
                minLength={8}
                maxLength={128}
                placeholder="Contraseña inicial"
                value={newUser.password}
                onChange={(event) =>
                  setNewUser((value) => ({
                    ...value,
                    password: event.target.value,
                  }))
                }
              />
              <Button type="submit" disabled={busy}>
                <UserPlus /> Crear acceso
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" /> Mi contraseña
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => onChangePassword(currentPassword, newPassword));
            }}
          >
            <Input
              aria-label="Contraseña actual"
              required
              type="password"
              maxLength={128}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Contraseña actual"
            />
            <Input
              aria-label="Nueva contraseña"
              required
              type="password"
              minLength={8}
              maxLength={128}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Nueva contraseña"
            />
            <Button type="submit" variant="outline" disabled={busy}>
              Cambiar contraseña
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Al cambiarla se cerrarán todas tus sesiones.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Personas asociadas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.persons.map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between rounded-xl border p-3"
            >
              <span className="font-medium">{person.name}</span>
              <span className="text-xs text-muted-foreground">
                {person.archived ? 'Archivada' : 'Activa'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
