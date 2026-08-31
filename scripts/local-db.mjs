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

const expectedColumns = {
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
  'idx_appointments_person_date',
  'idx_medications_person_active',
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
  const documentsMissing = documentTables.every((name) =>
    missing.includes(name),
  );
  const onlyDocumentsMissing =
    documentsMissing && missing.length === documentTables.length;
  const migrations = hasMigrationTable ? appliedMigrations(true) : [];
  const documentsMayBePending =
    onlyDocumentsMissing && !migrations.includes(documentMigration);
  if (missing.length && !documentsMayBePending) {
    problems.push(`faltan tablas: ${missing.join(', ')}`);
  }

  for (const [table, expected] of Object.entries(expectedColumns)) {
    if (!presentTables.has(table)) continue;
    const columns = query(`PRAGMA table_info(${table})`).map(
      ({ name }) => name,
    );
    if (columns.join('|') !== expected.join('|'))
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
      !(documentsMayBePending && documentIndexes.has(name)),
  );
  if (missingIndexes.length)
    problems.push(`faltan índices: ${missingIndexes.join(', ')}`);

  const presentTriggers = new Set(
    objects.filter(({ type }) => type === 'trigger').map(({ name }) => name),
  );
  const missingTriggers = expectedTriggers.filter(
    (name) => !presentTriggers.has(name),
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
