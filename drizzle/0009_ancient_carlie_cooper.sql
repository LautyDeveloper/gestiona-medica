-- Drizzle expresa estas reglas como CHECK en db/schema.ts. D1 ejecuta las
-- migraciones dentro de una transacción y no permite desactivar foreign_keys
-- allí, por lo que reconstruir tablas relacionadas falla. Estos triggers
-- aplican las mismas reglas sin poner en riesgo las referencias existentes.
CREATE TRIGGER `appointments_integrity_insert`
BEFORE INSERT ON `appointments`
WHEN NEW.`status` NOT IN ('Próximo', 'Realizado', 'Cancelado') OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'appointments integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `appointments_integrity_update`
BEFORE UPDATE ON `appointments`
WHEN NEW.`status` NOT IN ('Próximo', 'Realizado', 'Cancelado') OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'appointments integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `login_rate_limits_integrity_insert`
BEFORE INSERT ON `login_rate_limits`
WHEN NEW.`attempt_count` < 0
BEGIN
  SELECT RAISE(ABORT, 'login_rate_limits integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `login_rate_limits_integrity_update`
BEFORE UPDATE ON `login_rate_limits`
WHEN NEW.`attempt_count` < 0
BEGIN
  SELECT RAISE(ABORT, 'login_rate_limits integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `medical_orders_integrity_insert`
BEFORE INSERT ON `medical_orders`
WHEN NEW.`status` NOT IN ('pending', 'used') OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'medical_orders integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `medical_orders_integrity_update`
BEFORE UPDATE ON `medical_orders`
WHEN NEW.`status` NOT IN ('pending', 'used') OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'medical_orders integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `medications_integrity_insert`
BEFORE INSERT ON `medications`
WHEN NEW.`active` NOT IN (0, 1) OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'medications integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `medications_integrity_update`
BEFORE UPDATE ON `medications`
WHEN NEW.`active` NOT IN (0, 1) OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'medications integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `memberships_integrity_insert`
BEFORE INSERT ON `memberships`
WHEN NEW.`role` NOT IN ('admin', 'member')
BEGIN
  SELECT RAISE(ABORT, 'memberships integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `memberships_integrity_update`
BEFORE UPDATE ON `memberships`
WHEN NEW.`role` NOT IN ('admin', 'member')
BEGIN
  SELECT RAISE(ABORT, 'memberships integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `persons_integrity_insert`
BEFORE INSERT ON `persons`
WHEN NEW.`archived` NOT IN (0, 1) OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'persons integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `persons_integrity_update`
BEFORE UPDATE ON `persons`
WHEN NEW.`archived` NOT IN (0, 1) OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'persons integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `prescriptions_integrity_insert`
BEFORE INSERT ON `prescriptions`
WHEN NEW.`status` NOT IN ('pending', 'used') OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'prescriptions integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `prescriptions_integrity_update`
BEFORE UPDATE ON `prescriptions`
WHEN NEW.`status` NOT IN ('pending', 'used') OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'prescriptions integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `tasks_integrity_insert`
BEFORE INSERT ON `tasks`
WHEN NEW.`priority` NOT IN ('Normal', 'Importante', 'Urgente')
  OR NEW.`status` NOT IN ('Pendiente', 'Completado')
  OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'tasks integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `tasks_integrity_update`
BEFORE UPDATE ON `tasks`
WHEN NEW.`priority` NOT IN ('Normal', 'Importante', 'Urgente')
  OR NEW.`status` NOT IN ('Pendiente', 'Completado')
  OR NEW.`version` <= 0
BEGIN
  SELECT RAISE(ABORT, 'tasks integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `users_integrity_insert`
BEFORE INSERT ON `users`
WHEN NEW.`user_type` NOT IN ('caregiver', 'elder') OR NEW.`failed_login_count` < 0
BEGIN
  SELECT RAISE(ABORT, 'users integrity constraint failed');
END;--> statement-breakpoint
CREATE TRIGGER `users_integrity_update`
BEFORE UPDATE ON `users`
WHEN NEW.`user_type` NOT IN ('caregiver', 'elder') OR NEW.`failed_login_count` < 0
BEGIN
  SELECT RAISE(ABORT, 'users integrity constraint failed');
END;--> statement-breakpoint
PRAGMA optimize;
