import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wranglerBin = resolve(
  projectRoot,
  'node_modules/wrangler/bin/wrangler.js',
);
const configPath = resolve(projectRoot, 'wrangler.local.jsonc');
const persistPath = resolve(
  projectRoot,
  process.env.CERCA_LOCAL_DB_PATH || '.wrangler/state',
);
const database = 'site-creator-d1';
const mode = process.argv[2] || 'migrate';

const legacyMigrations = [
  '0000_polite_moira_mactaggert.sql',
  '0001_famous_vision.sql',
  '0002_clear_excalibur.sql',
  '0003_solid_mongu.sql',
  '0004_silky_thundra.sql',
];
const documentMigration = '0006_medical_orders_prescriptions.sql';
const documentTables = ['medical_orders', 'prescriptions'];
const alertsMigration = '0010_sloppy_peter_parker.sql';
const alertTables = ['alert_preferences', 'alert_states'];
const medicationMigration = '0011_keen_mac_gargan.sql';
const medicationTables = [
  'medication_intakes',
  'medication_schedule_times',
  'medication_stock_movements',
];

const expectedColumns = {
  alert_preferences: [
    'user_id',
    'appointment_lead_minutes',
    'task_lead_days',
    'document_lead_days',
    'updated_at',
    'medication_lead_minutes',
    'medication_stock_enabled',
  ],
  alert_states: [
    'user_id',
    'alert_key',
    'read_at',
    'snoozed_until',
    'updated_at',
  ],
  appointments: [
    'id',
    'person_id',
    'specialty',
    'doctor',
    'date',
    'time',
    'place',
    'bring',
    'notes',
    'status',
    'version',
  ],
  care_groups: ['id', 'name', 'created_at'],
  medical_orders: [
    'id',
    'person_id',
    'specialty',
    'reason',
    'requested_by',
    'issue_date',
    'expiration_date',
    'notes',
    'status',
    'appointment_id',
    'used_at',
    'version',
  ],
  medications: [
    'id',
    'person_id',
    'name',
    'dose',
    'frequency',
    'doctor',
    'notes',
    'active',
    'version',
    'schedule_type',
    'start_date',
    'end_date',
    'interval_minutes',
    'interval_anchor_at',
    'presentation',
    'stock_unit',
    'units_per_intake_milli',
    'stock_quantity_milli',
    'reorder_threshold_milli',
    'stock_cycle',
  ],
  medication_intakes: [
    'id',
    'medication_id',
    'person_id',
    'scheduled_for',
    'reported_at',
    'status',
    'notes',
    'recorded_by_user_id',
    'recorded_by_name',
    'created_at',
    'voided_at',
    'voided_by_user_id',
  ],
  medication_schedule_times: ['id', 'medication_id', 'local_time', 'position'],
  medication_stock_movements: [
    'id',
    'medication_id',
    'intake_id',
    'delta_milli',
    'reason',
    'recorded_by_user_id',
    'recorded_at',
  ],
  memberships: ['id', 'user_id', 'care_group_id', 'role', 'created_at'],
  persons: [
    'id',
    'name',
    'birth_date',
    'relationship',
    'notes',
    'archived',
    'care_group_id',
    'version',
  ],
  prescriptions: [
    'id',
    'person_id',
    'medication_name',
    'presentation',
    'dose',
    'frequency',
    'duration',
    'prescribed_by',
    'issue_date',
    'expiration_date',
    'notes',
    'status',
    'medication_id',
    'used_at',
    'version',
  ],
  sessions: [
    'id',
    'user_id',
    'token_hash',
    'created_at',
    'expires_at',
    'revoked_at',
  ],
  tasks: [
    'id',
    'person_id',
    'title',
    'due_date',
    'priority',
    'status',
    'notes',
    'version',
    'visible_to_elder',
  ],
  users: [
    'id',
    'username',
    'display_name',
    'password_hash',
    'user_type',
    'failed_login_count',
    'locked_until',
    'created_at',
    'last_seen_at',
  ],
};

const expectedIndexes = [
  'idx_alert_states_user_updated',
  'idx_appointments_person_date',
  'idx_medications_person_active',
  'idx_medication_intakes_person_reported',
  'idx_medication_intakes_medication_reported',
  'idx_medication_intakes_scheduled_active',
  'idx_medication_schedule_times_unique',
  'idx_medication_schedule_times_medication',
  'idx_medication_stock_movements_medication',
  'idx_medication_stock_movements_intake',
  'idx_medical_orders_person_status_expiration',
  'idx_memberships_group_user',
  'idx_memberships_user',
  'idx_persons_group_archived_name',
  'idx_prescriptions_person_status_expiration',
  'idx_sessions_user',
  'idx_tasks_person_status_date',
  'idx_users_username_nocase',
  'sessions_token_hash_unique',
];

const expectedTriggers = [
  'persons_care_group_insert',
  'persons_care_group_update',
  'tasks_elder_visibility_insert',
  'tasks_elder_visibility_update',
  'medication_structure_insert',
  'medication_structure_update',
  'alert_medication_preferences_insert',
  'alert_medication_preferences_update',
];

function wrangler(args, { json = false, inherit = false } = {}) {
  const output = execFileSync(process.execPath, [wranglerBin, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
      WRANGLER_WRITE_LOGS: 'false',
    },
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (!json) return output || '';
  const parsed = JSON.parse(output || '[]');
  return parsed.flatMap((result) => result.results || []);
}

function d1Args(...args) {
  return [
    'd1',
    ...args,
    database,
    '--local',
    '--config',
    configPath,
    '--persist-to',
    persistPath,
  ];
}

function query(sql) {
  return wrangler(
    [
      'd1',
      'execute',
      database,
      '--local',
      '--config',
      configPath,
      '--persist-to',
      persistPath,
      '--command',
      sql,
      '--json',
      '--yes',
    ],
    { json: true },
  );
}

function migrationFiles() {
  return readdirSync(resolve(projectRoot, 'drizzle'))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
}

function inspectSchema() {
  const objects = query(
    "SELECT type, name FROM sqlite_schema WHERE type IN ('table', 'index', 'trigger') ORDER BY type, name",
  );
  const appTables = Object.keys(expectedColumns);
  const presentTables = new Set(
    objects.filter(({ type }) => type === 'table').map(({ name }) => name),
  );
  const presentAppTables = appTables.filter((name) => presentTables.has(name));
  const hasMigrationTable = presentTables.has('d1_migrations');

  if (presentAppTables.length === 0)
    return { kind: 'empty', hasMigrationTable };

  const problems = [];
  const missing = appTables.filter((name) => !presentTables.has(name));
  const missingWithoutAlerts = missing.filter(
    (name) => !alertTables.includes(name),
  );
  const documentsMissing = documentTables.every((name) =>
    missingWithoutAlerts.includes(name),
  );
  const onlyDocumentsMissing =
    documentsMissing && missingWithoutAlerts.length === documentTables.length;
  const migrations = hasMigrationTable ? appliedMigrations(true) : [];
  const documentsMayBePending =
    onlyDocumentsMissing && !migrations.includes(documentMigration);
  const alertsMayBePending = !migrations.includes(alertsMigration);
  const medicationMayBePending = !migrations.includes(medicationMigration);
  const unexpectedMissing = missing.filter(
    (name) =>
      !(alertsMayBePending && alertTables.includes(name)) &&
      !(medicationMayBePending && medicationTables.includes(name)),
  );
  if (unexpectedMissing.length && !documentsMayBePending) {
    problems.push(`faltan tablas: ${unexpectedMissing.join(', ')}`);
  }

  for (const [table, expected] of Object.entries(expectedColumns)) {
    if (!presentTables.has(table)) continue;
    const columns = query(`PRAGMA table_info(${table})`).map(
      ({ name }) => name,
    );
    let expectedBeforeAlerts =
      alertsMayBePending && table === 'tasks'
        ? expected.filter((column) => column !== 'visible_to_elder')
        : expected;
    if (medicationMayBePending && table === 'alert_preferences')
      expectedBeforeAlerts = expectedBeforeAlerts.filter(
        (column) =>
          column !== 'medication_lead_minutes' &&
          column !== 'medication_stock_enabled',
      );
    if (medicationMayBePending && table === 'medications')
      expectedBeforeAlerts = expectedBeforeAlerts.filter(
        (column) =>
          ![
            'schedule_type',
            'start_date',
            'end_date',
            'interval_minutes',
            'interval_anchor_at',
            'presentation',
            'stock_unit',
            'units_per_intake_milli',
            'stock_quantity_milli',
            'reorder_threshold_milli',
            'stock_cycle',
          ].includes(column),
      );
    if (columns.join('|') !== expectedBeforeAlerts.join('|'))
      problems.push(`las columnas de ${table} no coinciden`);
  }

  const presentIndexes = new Set(
    objects.filter(({ type }) => type === 'index').map(({ name }) => name),
  );
  const documentIndexes = new Set([
    'idx_medical_orders_person_status_expiration',
    'idx_prescriptions_person_status_expiration',
  ]);
  const missingIndexes = expectedIndexes.filter(
    (name) =>
      !presentIndexes.has(name) &&
      !(documentsMayBePending && documentIndexes.has(name)) &&
      !(alertsMayBePending && name === 'idx_alert_states_user_updated') &&
      !(
        medicationMayBePending &&
        (name.startsWith('idx_medication_') ||
          name.startsWith('idx_medication_schedule_'))
      ),
  );
  if (missingIndexes.length)
    problems.push(`faltan índices: ${missingIndexes.join(', ')}`);

  const presentTriggers = new Set(
    objects.filter(({ type }) => type === 'trigger').map(({ name }) => name),
  );
  const missingTriggers = expectedTriggers.filter(
    (name) =>
      !presentTriggers.has(name) &&
      !(
        alertsMayBePending &&
        (name === 'tasks_elder_visibility_insert' ||
          name === 'tasks_elder_visibility_update')
      ) &&
      !(
        medicationMayBePending &&
        (name.startsWith('medication_structure_') ||
          name.startsWith('alert_medication_preferences_'))
      ),
  );
  if (missingTriggers.length)
    problems.push(`faltan triggers: ${missingTriggers.join(', ')}`);

  return problems.length
    ? { kind: 'incompatible', hasMigrationTable, problems }
    : {
        kind: 'legacy-current',
        hasMigrationTable,
        documentSchemaPresent: documentTables.every((name) =>
          presentTables.has(name),
        ),
      };
}

function appliedMigrations(hasMigrationTable) {
  if (!hasMigrationTable) return [];
  return query('SELECT name FROM d1_migrations ORDER BY id').map(
    ({ name }) => name,
  );
}

function printStatus(schema) {
  if (schema.kind === 'incompatible') {
    console.error('La D1 local tiene un esquema parcial o incompatible:');
    for (const problem of schema.problems) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }

  const applied = appliedMigrations(schema.hasMigrationTable);
  const pending = migrationFiles().filter((name) => !applied.includes(name));
  if (schema.kind === 'empty') console.log('D1 local vacía.');
  else if (!schema.hasMigrationTable)
    console.log(
      'D1 local compatible, pendiente de registrar migraciones previas.',
    );
  else console.log(`D1 local lista (${applied.length} migraciones aplicadas).`);
  if (pending.length) console.log(`Pendientes: ${pending.join(', ')}`);
  else console.log('No hay migraciones pendientes.');
}

function adoptLegacyDatabase(schema) {
  const adopted = schema.documentSchemaPresent
    ? [...legacyMigrations, documentMigration]
    : legacyMigrations;
  const values = adopted
    .map((name) => `('${name.replaceAll("'", "''")}')`)
    .join(',');
  query(`CREATE TABLE d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  ); INSERT INTO d1_migrations (name) VALUES ${values}`);
  console.log(
    'Se registró el esquema local existente sin modificar sus datos.',
  );
}

function migrate() {
  const schema = inspectSchema();
  if (schema.kind === 'incompatible') {
    printStatus(schema);
    console.error(
      'No se aplicaron migraciones. Corregí el esquema local o restaurá una copia compatible.',
    );
    return;
  }
  if (schema.kind === 'legacy-current' && schema.hasMigrationTable) {
    const applied = appliedMigrations(true);
    const missingLegacy = legacyMigrations.filter(
      (name) => !applied.includes(name),
    );
    if (missingLegacy.length) {
      console.error(
        `El esquema está actualizado, pero el historial de migraciones está incompleto: ${missingLegacy.join(', ')}`,
      );
      console.error('No se modificó la D1 local.');
      process.exitCode = 1;
      return;
    }
  }
  if (schema.kind === 'legacy-current' && !schema.hasMigrationTable)
    adoptLegacyDatabase(schema);

  wrangler(d1Args('migrations', 'apply'), { inherit: true });
}

if (mode === 'status') printStatus(inspectSchema());
else if (mode === 'migrate') migrate();
else throw new Error(`Modo desconocido: ${mode}`);
