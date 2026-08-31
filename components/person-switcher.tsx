'use client';

import { Check, ChevronDown, Plus, Settings2, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
                ? 'app-surface flex h-10 max-w-44 items-center gap-2 rounded-xl px-3 text-sm font-semibold'
                : 'w-full rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4 text-left shadow-sm transition-all hover:border-sidebar-primary/25 hover:bg-sidebar-accent hover:shadow-md'
            }
          />
        }
      >
        {compact ? (
          <>
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-4" />
            </span>
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
        <DropdownMenuGroup>
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
        </DropdownMenuGroup>
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
