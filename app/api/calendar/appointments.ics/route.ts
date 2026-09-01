import { getD1 } from '@/db';
import { appointmentsIcs, type CalendarAppointment } from '@/lib/calendar-ics';
import { authError, AuthError, requireUser } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const requestedPersonId = params.get('personId') || '';
    const appointmentId = params.get('appointmentId') || '';
    const careGroupId = params.get('careGroupId') || '';
    const db = getD1();
    let personId = requestedPersonId;

    if (user.userType === 'elder') {
      const person = await db
        .prepare(
          `SELECT p.id FROM person_access pa JOIN persons p ON p.id = pa.person_id
           WHERE pa.user_id = ? AND p.archived = 0`,
        )
        .bind(user.id)
        .first<{ id: string }>();
      if (!person)
        throw new AuthError('No tenés un perfil activo asociado', 403);
      if (personId && personId !== person.id)
        throw new AuthError('No tenés acceso a este perfil', 403);
      personId = person.id;
    } else {
      if (!careGroupId || !personId)
        throw new AuthError('Falta indicar el grupo o la persona', 400);
      const access = await db
        .prepare(
          `SELECT 1 FROM memberships m JOIN persons p ON p.care_group_id = m.care_group_id
           WHERE m.user_id = ? AND m.care_group_id = ? AND p.id = ? AND p.archived = 0`,
        )
        .bind(user.id, careGroupId, personId)
        .first();
      if (!access) throw new AuthError('No tenés acceso a este perfil', 403);
    }

    const nowArgentina = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .reduce<Record<string, string>>((values, part) => {
        values[part.type] = part.value;
        return values;
      }, {});
    const current = `${nowArgentina.year}-${nowArgentina.month}-${nowArgentina.day}T${nowArgentina.hour}:${nowArgentina.minute}`;
    const appointments = await db
      .prepare(
        `SELECT a.id, a.specialty, a.date, a.time, a.place, p.name AS personName
         FROM appointments a JOIN persons p ON p.id = a.person_id
         WHERE a.person_id = ? AND a.status = 'Próximo'
           AND (a.date || 'T' || a.time) >= ?
           AND (? = '' OR a.id = ?)
         ORDER BY a.date, a.time`,
      )
      .bind(personId, current, appointmentId, appointmentId)
      .all<CalendarAppointment>();
    if (!appointments.results.length)
      return Response.json(
        { error: 'No hay turnos próximos para exportar' },
        { status: 404 },
      );
    const filename = appointmentId
      ? 'cerca-turno.ics'
      : `cerca-turnos-${new Date().toISOString().slice(0, 10)}.ics`;
    return new Response(appointmentsIcs(appointments.results), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (error) {
    return authError(error);
  }
}
