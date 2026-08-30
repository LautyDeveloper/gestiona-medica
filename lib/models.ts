export type Section = 'home' | 'appointments' | 'medications' | 'tasks';
export type Entity = 'appointment' | 'medication' | 'task';

export interface Person {
  id: string;
  name: string;
  birthDate: string;
  relationship: string;
  notes: string;
  archived: boolean;
}

export interface PersonSummary extends Person {
  appointmentCount: number;
  medicationCount: number;
  taskCount: number;
}
export interface Appointment {
  id: string;
  personId: string;
  specialty: string;
  doctor: string;
  date: string;
  time: string;
  place: string;
  bring: string;
  notes: string;
  status: 'Próximo' | 'Realizado' | 'Cancelado';
}
export interface Medication {
  id: string;
  personId: string;
  name: string;
  dose: string;
  frequency: string;
  doctor: string;
  notes: string;
  active: boolean;
}
export interface MedicalTask {
  id: string;
  personId: string;
  title: string;
  dueDate: string;
  priority: 'Normal' | 'Importante' | 'Urgente';
  status: 'Pendiente' | 'Completado';
  notes: string;
}
export interface AppData {
  person: Person | null;
  appointments: Appointment[];
  medications: Medication[];
  tasks: MedicalTask[];
}

export interface PeopleData {
  persons: PersonSummary[];
}

export interface BackupDataV1 {
  schemaVersion: 1;
  exportedAt: string;
  person: Omit<Person, 'archived'>;
  appointments: Appointment[];
  medications: Medication[];
  tasks: MedicalTask[];
}

export interface BackupData {
  schemaVersion: 2;
  exportedAt: string;
  persons: Person[];
  appointments: Appointment[];
  medications: Medication[];
  tasks: MedicalTask[];
}
