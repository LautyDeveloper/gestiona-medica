export type Section = 'home' | 'appointments' | 'medications' | 'tasks';
export type Entity = 'appointment' | 'medication' | 'task';

export interface Person { id: string; name: string }
export interface Appointment { id: string; personId: string; specialty: string; doctor: string; date: string; time: string; place: string; bring: string; notes: string; status: 'Próximo' | 'Realizado' | 'Cancelado' }
export interface Medication { id: string; personId: string; name: string; dose: string; frequency: string; doctor: string; notes: string; active: boolean }
export interface MedicalTask { id: string; personId: string; title: string; dueDate: string; priority: 'Normal' | 'Importante' | 'Urgente'; status: 'Pendiente' | 'Completado'; notes: string }
export interface AppData { person: Person; appointments: Appointment[]; medications: Medication[]; tasks: MedicalTask[] }
