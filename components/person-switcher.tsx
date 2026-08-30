'use client';

import { Check, ChevronDown, Plus, Settings2, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Person, PersonSummary } from '@/lib/models';

export function PersonSwitcher({
  activePerson,
  people,
  compact = false,
  onSelect,
  onAdd,
  onManage,
}: {
  activePerson: Person;
  people: PersonSummary[];
  compact?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onManage: () => void;
}) {
  const activePeople = people.filter((person) => !person.archived);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Perfil activo: ${activePerson.name}`}
            className={
              compact
                ? 'flex h-10 max-w-44 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium'
                : 'w-full rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4 text-left transition-colors hover:bg-sidebar-accent'
            }
          />
        }
      >
        {compact ? (
          <>
            <UserRound className="size-4 shrink-0 text-primary" />
            <span className="truncate">{activePerson.name}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        ) : (
          <>
            <span className="block text-xs font-medium text-muted-foreground">
              Perfil activo
            </span>
            <span className="mt-1 flex items-center justify-between font-semibold">
              <span className="truncate">{activePerson.name}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={compact ? 'bottom' : 'top'}
        align={compact ? 'end' : 'start'}
        className="min-w-60"
      >
        <DropdownMenuLabel>Cambiar de persona</DropdownMenuLabel>
        {activePeople.map((person) => (
          <DropdownMenuItem
            key={person.id}
            onClick={() => onSelect(person.id)}
            className="min-h-10"
          >
            <UserRound />
            <span className="flex-1 truncate">{person.name}</span>
            {person.id === activePerson.id && (
              <Check className="text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAdd}>
          <Plus />
          Agregar persona
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onManage}>
          <Settings2 />
          Administrar personas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
