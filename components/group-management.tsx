'use client';

import { Copy, Link2, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CareGroup, GroupData } from '@/lib/models';

export function GroupOnboarding({
  onCreate,
}: {
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <form
        className="w-full max-w-md rounded-3xl border bg-card p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onCreate(name);
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : 'No se pudo crear el grupo',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
          Primer paso
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          Creá tu grupo de cuidado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Después podrás sumar perfiles e invitar familiares mediante un enlace.
        </p>
        <label
          htmlFor="first-group-name"
          className="mt-6 grid gap-2 text-sm font-medium"
        >
          Nombre del grupo
        </label>
        <Input
          id="first-group-name"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Familia Aquino"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-5 w-full" disabled={busy}>
          {busy ? 'Creando…' : 'Crear grupo'}
        </Button>
      </form>
    </main>
  );
}

export function GroupSwitcher({
  groups,
  activeId,
  onSelect,
  onAdd,
}: {
  groups: CareGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Grupo activo
      </span>
      <select
        aria-label="Grupo activo"
        className="h-10 rounded-xl border bg-card px-3 text-sm"
        value={activeId}
        onChange={(event) => onSelect(event.target.value)}
      >
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <button
        className="flex items-center gap-2 text-xs text-primary"
        onClick={onAdd}
      >
        <Plus className="size-3" /> Crear otro grupo
      </button>
    </div>
  );
}

export function GroupView({
  data,
  inviteUrl,
  onCreateInvite,
  onCopy,
  onRevoke,
  onRename,
}: {
  data: GroupData;
  inviteUrl: string;
  onCreateInvite: () => void;
  onCopy: () => void;
  onRevoke: (id: string) => void;
  onRename: (name: string) => Promise<void>;
}) {
  const admin = data.group.role === 'admin';
  const [name, setName] = useState(data.group.name);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
              disabled={!name.trim() || name.trim() === data.group.name}
              onClick={() => void onRename(name)}
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
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-xl border p-3"
            >
              <UserRound className="text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{member.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{member.username} · {member.email}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2 py-1 text-xs">
                {member.role === 'admin' ? 'Administrador' : 'Miembro'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5" /> Invitaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admin ? (
            <>
              <p className="text-sm text-muted-foreground">
                Generá un enlace de un solo uso, válido durante siete días.
              </p>
              {inviteUrl ? (
                <div className="mt-4 flex gap-2">
                  <Input readOnly value={inviteUrl} />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copiar invitación"
                    onClick={onCopy}
                  >
                    <Copy />
                  </Button>
                </div>
              ) : (
                <Button className="mt-4" onClick={onCreateInvite}>
                  Crear invitación
                </Button>
              )}
              <div className="mt-5 grid gap-2">
                {data.invitations
                  .filter((invite) => invite.status === 'pending')
                  .map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-xl border p-3 text-sm"
                    >
                      <span>
                        Vence{' '}
                        {new Date(invite.expiresAt).toLocaleDateString('es-AR')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRevoke(invite.id)}
                      >
                        Revocar
                      </Button>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4" /> Sólo un administrador puede
              crear invitaciones.
            </p>
          )}
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
