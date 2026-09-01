import { z } from 'zod';
import type { BackupData } from '@/lib/models';

const cleanText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} es obligatorio`)
    .max(max, `${label} es demasiado largo`);
const optionalText = (max: number) =>
  z.string().trim().max(max, 'El texto es demasiado largo').default('');
function isCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida')
  .refine(isCalendarDate, 'Ingresá una fecha válida');

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
export const usernameSchema = z
  .string()
  .trim()
  .min(2, 'El usuario debe tener al menos 2 caracteres')
  .max(40, 'El usuario es demasiado largo')
  .regex(
    /^[\p{L}\p{N}._-]+$/u,
    'Usá solamente letras, números, punto, guion o guion bajo',
  );
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');
export const optionalPersonAccessSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
  })
  .optional();
export const createPersonSchema = z.object({
  careGroupId: z.uuid(),
  data: personSchema,
  access: optionalPersonAccessSchema,
});
export const createPersonAccessSchema = z.object({
  careGroupId: z.uuid(),
  personId: z.uuid(),
  username: usernameSchema,
  password: passwordSchema,
});
export const updatePersonAccessSchema = z
  .object({
    careGroupId: z.uuid(),
    personId: z.uuid(),
    username: usernameSchema.optional(),
    password: passwordSchema.optional(),
  })
  .refine(
    (value) => value.username !== undefined || value.password !== undefined,
    { message: 'No hay cambios para guardar' },
  );
export const deletePersonAccessSchema = z.object({
  careGroupId: z.uuid(),
  personId: z.uuid(),
});
export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Ingresá tu contraseña').max(128),
});
export const bootstrapSchema = loginSchema.extend({
  displayName: cleanText('El nombre', 120),
  groupName: cleanText('El nombre del grupo', 120),
  password: passwordSchema,
});
export const createUserSchema = z.object({
  careGroupId: z.uuid(),
  username: usernameSchema,
  displayName: cleanText('El nombre', 120),
  password: passwordSchema,
});
export const resetPasswordSchema = z.object({
  careGroupId: z.uuid(),
  userId: z.uuid(),
  password: passwordSchema,
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresá tu contraseña actual').max(128),
  newPassword: passwordSchema,
});

export function normalizeAppointmentTime(value: string) {
  const compact = value
    .trim()
    .toLocaleLowerCase('es-AR')
    .replaceAll('.', '')
    .replaceAll(/\s/g, '');
  const match = /^(\d{1,2})(?::(\d{1,2}))?(am|pm|h|hs)?$/.exec(compact);
  if (!match) return value.trim();

  let hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const suffix = match[3];
  if (minute > 59) return value.trim();
  if (suffix === 'am' || suffix === 'pm') {
    if (hour < 1 || hour > 12) return value.trim();
    if (suffix === 'am' && hour === 12) hour = 0;
    if (suffix === 'pm' && hour !== 12) hour += 12;
  } else if (hour > 23) return value.trim();

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const appointmentSchema = z.object({
  personId: z.uuid().optional(),
  specialty: cleanText('La especialidad', 100),
  doctor: cleanText('El médico', 120),
  date: isoDate,
  time: z.preprocess(
    (value) =>
      typeof value === 'string' ? normalizeAppointmentTime(value) : value,
    z
      .string()
      .regex(
        /^([01]\d|2[0-3]):[0-5]\d$/,
        'Ingresá una hora válida, por ejemplo 14:00',
      ),
  ),
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

function documentDates<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((value, context) => {
    const dates = value as { issueDate?: string; expirationDate?: string };
    if (
      dates.issueDate &&
      dates.expirationDate &&
      dates.expirationDate < dates.issueDate
    )
      context.addIssue({
        code: 'custom',
        path: ['expirationDate'],
        message: 'El vencimiento no puede ser anterior a la emisión',
      });
  });
}

export const orderSchema = documentDates({
  personId: z.uuid().optional(),
  specialty: cleanText('La especialidad', 100),
  reason: cleanText('El motivo', 500),
  requestedBy: cleanText('El médico solicitante', 120),
  issueDate: isoDate,
  expirationDate: isoDate,
  notes: optionalText(1000),
});

export const prescriptionSchema = documentDates({
  personId: z.uuid().optional(),
  medicationName: cleanText('El medicamento', 120),
  presentation: cleanText('La presentación', 120),
  dose: cleanText('La dosis', 80),
  frequency: cleanText('La frecuencia', 120),
  duration: cleanText('La duración', 120),
  prescribedBy: cleanText('El médico prescriptor', 120),
  issueDate: isoDate,
  expirationDate: isoDate,
  notes: optionalText(1000),
});

export const taskSchema = z.object({
  personId: z.uuid().optional(),
  title: cleanText('El título', 200),
  dueDate: z.union([z.literal(''), isoDate]).default(''),
  priority: z.enum(['Normal', 'Importante', 'Urgente']).default('Normal'),
  status: z.enum(['Pendiente', 'Completado']).default('Pendiente'),
  notes: optionalText(1000),
  visibleToElder: z.boolean().default(false),
});

export const entitySchema = z.enum([
  'appointment',
  'order',
  'medication',
  'prescription',
  'task',
]);

export const recordSchemas = {
  appointment: appointmentSchema,
  order: orderSchema,
  medication: medicationSchema,
  prescription: prescriptionSchema,
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
const orderBackupSchema = documentDates({
  id: z.uuid(),
  personId: z.uuid(),
  specialty: cleanText('La especialidad', 100),
  reason: cleanText('El motivo', 500),
  requestedBy: cleanText('El médico solicitante', 120),
  issueDate: isoDate,
  expirationDate: isoDate,
  notes: optionalText(1000),
  status: z.enum(['pending', 'used']),
  appointmentId: z.uuid().nullable(),
  usedAt: z.iso.datetime().nullable(),
});
const prescriptionBackupSchema = documentDates({
  id: z.uuid(),
  personId: z.uuid(),
  medicationName: cleanText('El medicamento', 120),
  presentation: cleanText('La presentación', 120),
  dose: cleanText('La dosis', 80),
  frequency: cleanText('La frecuencia', 120),
  duration: cleanText('La duración', 120),
  prescribedBy: cleanText('El médico prescriptor', 120),
  issueDate: isoDate,
  expirationDate: isoDate,
  notes: optionalText(1000),
  status: z.enum(['pending', 'used']),
  medicationId: z.uuid().nullable(),
  usedAt: z.iso.datetime().nullable(),
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

export const backupV4Schema = z
  .object({
    schemaVersion: z.literal(4),
    exportedAt: z.iso.datetime(),
    careGroup: z.object({ name: cleanText('El nombre del grupo', 120) }),
    persons: z.array(personBackupSchema).min(1).max(1000),
    ...backupRecordsSchema,
    orders: z.array(orderBackupSchema).max(10000),
    prescriptions: z.array(prescriptionBackupSchema).max(10000),
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
      ...backup.orders,
      ...backup.medications,
      ...backup.prescriptions,
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
    const appointments = new Map(
      backup.appointments.map((item) => [item.id, item.personId]),
    );
    const medications = new Map(
      backup.medications.map((item) => [item.id, item.personId]),
    );
    if (
      backup.orders.some(
        (item) =>
          item.appointmentId &&
          appointments.get(item.appointmentId) !== item.personId,
      ) ||
      backup.prescriptions.some(
        (item) =>
          item.medicationId &&
          medications.get(item.medicationId) !== item.personId,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'El respaldo contiene vínculos de documentos inválidos',
      });
  });

export const backupV5Schema = z
  .object({
    schemaVersion: z.literal(5),
    exportedAt: z.iso.datetime(),
    careGroup: z.object({ name: cleanText('El nombre del grupo', 120) }),
    persons: z.array(personBackupSchema).min(1).max(1000),
    ...backupRecordsSchema,
    tasks: z.array(taskBackupSchema).max(10000),
    orders: z.array(orderBackupSchema).max(10000),
    prescriptions: z.array(prescriptionBackupSchema).max(10000),
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
      ...backup.orders,
      ...backup.medications,
      ...backup.prescriptions,
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
    const appointments = new Map(
      backup.appointments.map((item) => [item.id, item.personId]),
    );
    const medications = new Map(
      backup.medications.map((item) => [item.id, item.personId]),
    );
    if (
      backup.orders.some(
        (item) =>
          item.appointmentId &&
          appointments.get(item.appointmentId) !== item.personId,
      ) ||
      backup.prescriptions.some(
        (item) =>
          item.medicationId &&
          medications.get(item.medicationId) !== item.personId,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'El respaldo contiene vínculos de documentos inválidos',
      });
  });

export const backupImportSchema = z
  .union([
    backupV1Schema,
    backupV2Schema,
    backupV3Schema,
    backupV4Schema,
    backupV5Schema,
  ])
  .transform((backup): BackupData => {
    if (backup.schemaVersion === 5) return backup;
    if (backup.schemaVersion === 4)
      return {
        ...backup,
        schemaVersion: 5 as const,
        tasks: backup.tasks.map((task) => ({
          ...task,
          visibleToElder: false,
        })),
      };
    if (backup.schemaVersion === 3)
      return {
        ...backup,
        schemaVersion: 5 as const,
        tasks: backup.tasks.map((task) => ({
          ...task,
          visibleToElder: false,
        })),
        orders: [],
        prescriptions: [],
      };
    if (backup.schemaVersion === 2)
      return {
        ...backup,
        schemaVersion: 5 as const,
        tasks: backup.tasks.map((task) => ({
          ...task,
          visibleToElder: false,
        })),
        careGroup: { name: 'Grupo restaurado' },
        orders: [],
        prescriptions: [],
      };
    return {
      schemaVersion: 5 as const,
      exportedAt: backup.exportedAt,
      careGroup: { name: 'Grupo restaurado' },
      persons: [{ ...backup.person, archived: false }],
      appointments: backup.appointments,
      orders: [],
      medications: backup.medications,
      prescriptions: [],
      tasks: backup.tasks.map((task) => ({ ...task, visibleToElder: false })),
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
