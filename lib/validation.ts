import { z } from 'zod';

const cleanText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} es obligatorio`)
    .max(max, `${label} es demasiado largo`);
const optionalText = (max: number) =>
  z.string().trim().max(max, 'El texto es demasiado largo').default('');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida');

export const personSchema = z.object({
  name: cleanText('El nombre', 120),
  birthDate: isoDate.refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    'La fecha de nacimiento no puede ser futura',
  ),
  relationship: cleanText('El vínculo', 80),
  notes: optionalText(1000),
});

export const personArchiveSchema = z.object({
  id: z.uuid(),
  archived: z.boolean(),
  version: z.number().int().positive().optional(),
});

export const careGroupSchema = z.object({
  name: cleanText('El nombre del grupo', 120),
});
export const membershipRoleSchema = z.enum(['admin', 'member']);
export const invitationActionSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

export const appointmentSchema = z.object({
  personId: z.uuid().optional(),
  specialty: cleanText('La especialidad', 100),
  doctor: cleanText('El médico', 120),
  date: isoDate,
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ingresá una hora válida'),
  place: cleanText('El lugar', 160),
  bring: cleanText('Qué llevar', 500),
  notes: optionalText(1000),
  status: z.enum(['Próximo', 'Realizado', 'Cancelado']).default('Próximo'),
});

export const medicationSchema = z.object({
  personId: z.uuid().optional(),
  name: cleanText('El nombre', 120),
  dose: cleanText('La dosis', 80),
  frequency: cleanText('La frecuencia', 120),
  doctor: cleanText('El médico', 120),
  notes: optionalText(1000),
  active: z.boolean().default(true),
});

export const taskSchema = z.object({
  personId: z.uuid().optional(),
  title: cleanText('El título', 200),
  dueDate: z.union([z.literal(''), isoDate]).default(''),
  priority: z.enum(['Normal', 'Importante', 'Urgente']).default('Normal'),
  status: z.enum(['Pendiente', 'Completado']).default('Pendiente'),
  notes: optionalText(1000),
});

export const entitySchema = z.enum(['appointment', 'medication', 'task']);

export const recordSchemas = {
  appointment: appointmentSchema,
  medication: medicationSchema,
  task: taskSchema,
};

const personBackupV1Schema = personSchema.extend({ id: z.uuid() });
const personBackupSchema = personBackupV1Schema.extend({
  archived: z.boolean().default(false),
});
const appointmentBackupSchema = appointmentSchema.extend({
  id: z.uuid(),
  personId: z.uuid(),
});
const medicationBackupSchema = medicationSchema.extend({
  id: z.uuid(),
  personId: z.uuid(),
});
const taskBackupSchema = taskSchema.extend({
  id: z.uuid(),
  personId: z.uuid(),
});

const backupRecordsSchema = {
  appointments: z.array(appointmentBackupSchema).max(10000),
  medications: z.array(medicationBackupSchema).max(10000),
  tasks: z.array(taskBackupSchema).max(10000),
};

export const backupV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    person: personBackupV1Schema,
    ...backupRecordsSchema,
  })
  .superRefine((backup, context) => {
    const records = [
      ...backup.appointments,
      ...backup.medications,
      ...backup.tasks,
    ];
    if (records.some((record) => record.personId !== backup.person.id)) {
      context.addIssue({
        code: 'custom',
        message: 'El respaldo contiene registros asociados a otra persona',
      });
    }
    const ids = records.map((record) => record.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'El respaldo contiene identificadores duplicados',
      });
    }
  });

export const backupV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    exportedAt: z.iso.datetime(),
    persons: z.array(personBackupSchema).min(1).max(1000),
    ...backupRecordsSchema,
  })
  .superRefine((backup, context) => {
    const personIds = backup.persons.map((person) => person.id);
    if (new Set(personIds).size !== personIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'El respaldo contiene personas duplicadas',
      });
    }
    const knownPeople = new Set(personIds);
    const records = [
      ...backup.appointments,
      ...backup.medications,
      ...backup.tasks,
    ];
    if (records.some((record) => !knownPeople.has(record.personId))) {
      context.addIssue({
        code: 'custom',
        message:
          'El respaldo contiene registros asociados a una persona inexistente',
      });
    }
    const ids = records.map((record) => record.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'El respaldo contiene identificadores duplicados',
      });
    }
  });

export const backupV3Schema = z
  .object({
    schemaVersion: z.literal(3),
    exportedAt: z.iso.datetime(),
    careGroup: z.object({ name: cleanText('El nombre del grupo', 120) }),
    persons: z.array(personBackupSchema).min(1).max(1000),
    ...backupRecordsSchema,
  })
  .superRefine((backup, context) => {
    const personIds = backup.persons.map((person) => person.id);
    if (new Set(personIds).size !== personIds.length)
      context.addIssue({
        code: 'custom',
        message: 'El respaldo contiene personas duplicadas',
      });
    const knownPeople = new Set(personIds);
    const records = [
      ...backup.appointments,
      ...backup.medications,
      ...backup.tasks,
    ];
    if (records.some((record) => !knownPeople.has(record.personId)))
      context.addIssue({
        code: 'custom',
        message:
          'El respaldo contiene registros asociados a una persona inexistente',
      });
    const ids = records.map((record) => record.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: 'custom',
        message: 'El respaldo contiene identificadores duplicados',
      });
  });

export const backupImportSchema = z
  .union([backupV1Schema, backupV2Schema, backupV3Schema])
  .transform((backup) => {
    if (backup.schemaVersion === 3) return backup;
    if (backup.schemaVersion === 2)
      return {
        ...backup,
        schemaVersion: 3 as const,
        careGroup: { name: 'Grupo restaurado' },
      };
    return {
      schemaVersion: 3 as const,
      exportedAt: backup.exportedAt,
      careGroup: { name: 'Grupo restaurado' },
      persons: [{ ...backup.person, archived: false }],
      appointments: backup.appointments,
      medications: backup.medications,
      tasks: backup.tasks,
    };
  });

export const backupSchema = backupImportSchema;

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = typeof issue.path[0] === 'string' ? issue.path[0] : '_form';
    errors[key] = [...(errors[key] || []), issue.message];
  }
  return errors;
}
