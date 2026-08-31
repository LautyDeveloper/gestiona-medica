export type Section =
  | 'home'
  | 'appointments'
  | 'orders'
  | 'medications'
  | 'prescriptions'
  | 'tasks'
  | 'group';
export type Entity =
  | 'appointment'
  | 'order'
  | 'medication'
  | 'prescription'
  | 'task';
export type MembershipRole = 'admin' | 'member';
export type UserType = 'caregiver' | 'elder';
export type ElderSection = 'home' | 'appointments' | 'medications';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  userType: UserType;
}
export interface CareGroup {
  id: string;
  name: string;
  role: MembershipRole;
  memberCount: number;
  personCount: number;
}
export interface GroupMember {
  id: string;
  username: string;
  displayName: string;
  role: MembershipRole;
}
export type SessionData =
  | {
      user: AppUser & { userType: 'caregiver' };
      groups: CareGroup[];
      elderPerson: null;
    }
  | {
      user: AppUser & { userType: 'elder' };
      groups: [];
      elderPerson: Pick<Person, 'id' | 'name' | 'careGroupId'>;
    };
export interface GroupData {
  group: CareGroup;
  members: GroupMember[];
  persons: Pick<Person, 'id' | 'name' | 'archived'>[];
}

export interface Person {
  id: string;
  careGroupId?: string;
  name: string;
  birthDate: string;
  relationship: string;
  notes: string;
  archived: boolean;
  version?: number;
  access?: { username: string } | null;
}

export interface PersonSummary extends Person {
  appointmentCount: number;
  orderCount: number;
  medicationCount: number;
  prescriptionCount: number;
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
  version?: number;
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
  version?: number;
}
export type DocumentStatus = 'pending' | 'used';
export interface MedicalOrder {
  id: string;
  personId: string;
  specialty: string;
  reason: string;
  requestedBy: string;
  issueDate: string;
  expirationDate: string;
  notes: string;
  status: DocumentStatus;
  appointmentId: string | null;
  usedAt: string | null;
  version?: number;
}
export interface Prescription {
  id: string;
  personId: string;
  medicationName: string;
  presentation: string;
  dose: string;
  frequency: string;
  duration: string;
  prescribedBy: string;
  issueDate: string;
  expirationDate: string;
  notes: string;
  status: DocumentStatus;
  medicationId: string | null;
  usedAt: string | null;
  version?: number;
}
export interface MedicalTask {
  id: string;
  personId: string;
  title: string;
  dueDate: string;
  priority: 'Normal' | 'Importante' | 'Urgente';
  status: 'Pendiente' | 'Completado';
  notes: string;
  version?: number;
}
export interface AppData {
  person: Person | null;
  appointments: Appointment[];
  orders: MedicalOrder[];
  medications: Medication[];
  prescriptions: Prescription[];
  tasks: MedicalTask[];
}

export interface ElderData {
  person: Pick<Person, 'id' | 'name'>;
  appointments: Appointment[];
  medications: Medication[];
}

export interface PeopleData {
  persons: PersonSummary[];
}

export interface BackupDataV1 {
  schemaVersion: 1;
  exportedAt: string;
  person: Omit<Person, 'archived' | 'careGroupId' | 'version' | 'access'>;
  appointments: Omit<Appointment, 'version'>[];
  medications: Omit<Medication, 'version'>[];
  tasks: Omit<MedicalTask, 'version'>[];
}

export interface BackupData {
  schemaVersion: 4;
  exportedAt: string;
  careGroup: { name: string };
  persons: Omit<Person, 'careGroupId' | 'version' | 'access'>[];
  appointments: Omit<Appointment, 'version'>[];
  orders: Omit<MedicalOrder, 'version'>[];
  medications: Omit<Medication, 'version'>[];
  prescriptions: Omit<Prescription, 'version'>[];
  tasks: Omit<MedicalTask, 'version'>[];
}
