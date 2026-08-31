'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function AppLoading() {
  return (
    <div
      className="min-h-dvh bg-transparent p-5 md:ml-64 sm:p-8 lg:p-12"
      aria-label="Cargando datos"
    >
      <div className="mx-auto max-w-6xl space-y-7">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-5 lg:grid-cols-[1.35fr_.9fr]">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function AppError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-transparent p-6 text-foreground">
      <section className="app-surface max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle />
        </div>
        <h1 className="mt-4 text-xl font-semibold">
          No pudimos cargar tus datos
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <Button className="mt-6" onClick={onRetry}>
          <RotateCw />
          Reintentar
        </Button>
      </section>
    </main>
  );
}

export function ContentLoading() {
  return (
    <div className="space-y-6" aria-label="Cargando perfil">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-5 lg:grid-cols-[1.35fr_.9fr]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </div>
  );
}
