# Cerca

Cerca es una aplicación familiar para organizar información médica: personas,
turnos, órdenes, medicamentos, recetas, pendientes y alertas de vencimiento.
Corre sobre React/Vinext y Cloudflare Workers, con una base SQLite compatible
con Cloudflare D1.

## Requisitos

- Node.js 22.13.0 o posterior.
- npm (se usa `package-lock.json` para instalaciones reproducibles).

## Instalación local

```bash
npm ci
npm run dev
```

`npm run dev` aplica primero las migraciones pendientes sobre la base D1 local.
El estado se guarda en `.wrangler/state`; se puede cambiar esa ubicación con la
variable `CERCA_LOCAL_DB_PATH`.

En el primer ingreso la aplicación muestra el asistente de configuración. Ese
flujo crea el grupo familiar, el primer usuario cuidador con rol de administrador
y su sesión. La configuración inicial se bloquea automáticamente una vez creado
el primer usuario.

## Comandos

| Comando                    | Uso                                                     |
| -------------------------- | ------------------------------------------------------- |
| `npm run dev`              | Migra la base local e inicia el servidor de desarrollo. |
| `npm run db:status:local`  | Revisa tablas, índices, triggers y migraciones locales. |
| `npm run db:migrate:local` | Aplica las migraciones D1 pendientes.                   |
| `npm run db:generate`      | Genera una migración a partir de `db/schema.ts`.        |
| `npm run lint`             | Ejecuta el análisis estático.                           |
| `npm run typecheck`        | Verifica TypeScript sin emitir archivos.                |
| `npm test`                 | Ejecuta la suite de Vitest.                             |
| `npm run build`            | Genera el build de producción.                          |
| `npm run check`            | Reproduce CI: migraciones, lint, tipos, tests y build.  |

## Arquitectura

- `app/`: páginas y rutas API.
- `components/`: interfaz, vistas por dominio y flujos de gestión.
- `lib/`: autenticación, validación, modelos y utilidades compartidas.
- `db/schema.ts`: definición Drizzle de la base.
- `drizzle/`: migraciones SQL versionadas; no se deben modificar migraciones ya
  desplegadas.
- `scripts/local-db.mjs`: migración y diagnóstico seguro de la base local.
- `test/`: pruebas de UI, API, autenticación, respaldos y migraciones.

Las rutas API autentican la sesión contra D1 y verifican el acceso al grupo o a
la persona antes de operar. Los estados y booleanos críticos se validan tanto en
la aplicación como mediante restricciones de integridad en SQLite. El esquema
las declara como `CHECK`; la migración para tablas existentes usa triggers
equivalentes para preservar las claves foráneas durante el cambio.

## Migraciones

Para cambiar el esquema:

1. Editar `db/schema.ts`.
2. Ejecutar `npm run db:generate`.
3. Revisar el SQL generado y agregar una prueba de migración cuando reconstruya
   tablas o cambie restricciones.
4. Ejecutar `npm run check`.

CI instala con `npm ci` y ejecuta el mismo comando `npm run check` en cada pull
request y en cada push a `main`.

## Respaldos y recuperación

El respaldo actual usa `schemaVersion: 5` y contiene todas las personas y sus
registros dentro del grupo familiar seleccionado. La importación también acepta
versiones anteriores compatibles y las normaliza antes de escribir.

## Alertas y calendario

Las alertas se calculan a partir de turnos próximos, pendientes con fecha y
órdenes o recetas por vencer. Cada usuario conserva sus propias preferencias,
lecturas y posposiciones. Las cuentas vinculadas a una persona sólo ven sus
turnos y los pendientes que el cuidador haya decidido compartir.

La exportación `.ics` permite agregar un turno o la agenda próxima del perfil
activo a un calendario externo. El archivo incluye únicamente persona,
especialidad, fecha, hora y lugar; no exporta notas ni indicaciones médicas.
Estas alertas funcionan mientras se usa Cerca y no son notificaciones push en
segundo plano.

La restauración es destructiva: reemplaza las personas y la información médica
del grupo. Antes de restaurar:

1. Exportar un respaldo nuevo del estado actual.
2. Confirmar que el archivo corresponde al grupo correcto y pesa menos de 5 MB.
3. Realizar la restauración sin cerrar ni recargar la aplicación.
4. Verificar perfiles, turnos, documentos, medicamentos y pendientes.

La escritura se ejecuta como un lote atómico: si una operación falla, no debe
quedar una restauración parcial. Los usuarios cuidadores del grupo se conservan;
las asociaciones de acceso se reconstruyen a partir del respaldo.

Para recuperar un entorno local, conservar primero una copia de
`.wrangler/state`, ejecutar `npm run db:status:local` y luego
`npm run db:migrate:local`. Si los datos son irrecuperables, iniciar una base
local vacía y restaurar el último respaldo validado desde la aplicación.

## Despliegue

El proyecto está configurado para OpenAI Sites mediante `.openai/hosting.json`,
con el binding D1 `DB`. Los cambios de esquema deben desplegarse junto con su
migración y pasar `npm run check` antes de publicar una nueva versión.

No guardar contraseñas, respaldos médicos ni archivos de estado D1 en Git.
