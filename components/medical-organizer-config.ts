import {
  BellRing,
  CalendarDays,
  ClipboardCheck,
  ClipboardPlus,
  FileText,
  Home,
  Pill,
  Users,
} from 'lucide-react';
import type {
  Appointment,
  Entity,
  MedicalOrder,
  MedicalTask,
  Medication,
  Prescription,
  Section,
} from '@/lib/models';

export const ACTIVE_PERSON_KEY = 'activePersonId';

export const navItems: {
  id: Section;
  label: string;
  icon: typeof Home;
  activeClass: string;
}[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: Home,
    activeClass: 'bg-primary/10 text-primary ring-primary/15',
  },
  {
    id: 'appointments',
    label: 'Turnos',
    icon: CalendarDays,
    activeClass: 'bg-appointment/10 text-appointment ring-appointment/15',
  },
  {
    id: 'orders',
    label: 'Órdenes',
    icon: ClipboardPlus,
    activeClass: 'bg-order/10 text-order ring-order/15',
  },
  {
    id: 'medications',
    label: 'Medicamentos',
    icon: Pill,
    activeClass: 'bg-medication/10 text-medication ring-medication/15',
  },
  {
    id: 'prescriptions',
    label: 'Recetas',
    icon: FileText,
    activeClass: 'bg-prescription/10 text-prescription ring-prescription/15',
  },
  {
    id: 'tasks',
    label: 'Pendientes',
    icon: ClipboardCheck,
    activeClass: 'bg-task/10 text-task ring-task/15',
  },
  {
    id: 'alerts',
    label: 'Alertas',
    icon: BellRing,
    activeClass: 'bg-destructive/10 text-destructive ring-destructive/15',
  },
  {
    id: 'group',
    label: 'Grupo familiar',
    icon: Users,
    activeClass: 'bg-primary/10 text-primary ring-primary/15',
  },
];

export const headers: Record<
  Section,
  { title: string; eyebrow: string; action?: string; entity?: Entity }
> = {
  home: { title: 'Inicio', eyebrow: 'Resumen de hoy' },
  appointments: {
    title: 'Turnos',
    eyebrow: 'Agenda médica',
    action: 'Nuevo turno',
    entity: 'appointment',
  },
  orders: {
    title: 'Órdenes',
    eyebrow: 'Indicaciones para sacar turno',
    action: 'Nueva orden',
    entity: 'order',
  },
  medications: {
    title: 'Medicamentos',
    eyebrow: 'Tratamiento actual',
    action: 'Nuevo medicamento',
    entity: 'medication',
  },
  prescriptions: {
    title: 'Recetas',
    eyebrow: 'Indicaciones de medicamentos',
    action: 'Nueva receta',
    entity: 'prescription',
  },
  tasks: {
    title: 'Pendientes',
    eyebrow: 'Cosas por resolver',
    action: 'Nuevo pendiente',
    entity: 'task',
  },
  alerts: { title: 'Alertas', eyebrow: 'Recordatorios y vencimientos' },
  group: { title: 'Grupo familiar', eyebrow: 'Espacio compartido' },
};

export type RecordValue =
  | Appointment
  | MedicalOrder
  | Medication
  | Prescription
  | MedicalTask;

export type ConversionSource =
  | { entity: 'order'; item: MedicalOrder }
  | { entity: 'prescription'; item: Prescription };

export type DeleteTarget = {
  entity: Entity;
  id: string;
  personId: string;
  label: string;
};
