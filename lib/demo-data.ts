import type { AppData } from '@/lib/models';

export const demoData: AppData = {
  person: { id: 'person-elena', name: 'Elena Rodríguez' },
  appointments: [
    { id: 'apt-cardio', personId: 'person-elena', specialty: 'Cardiología', doctor: 'Dra. Laura Pérez', date: '2026-09-02', time: '10:30', place: 'Hospital Italiano', bring: 'DNI, credencial y análisis anteriores.', notes: 'Control habitual.', status: 'Próximo' },
    { id: 'apt-trauma', personId: 'person-elena', specialty: 'Traumatología', doctor: 'Dr. Martín Silva', date: '2026-09-08', time: '16:00', place: 'Centro Médico Belgrano', bring: 'Radiografía de rodilla y credencial.', notes: '', status: 'Próximo' },
    { id: 'apt-clinica', personId: 'person-elena', specialty: 'Clínica médica', doctor: 'Dr. Pablo Gómez', date: '2026-09-15', time: '09:15', place: 'Consultorios Palermo', bring: 'Lista de medicamentos actuales.', notes: '', status: 'Próximo' },
  ],
  medications: [
    { id: 'med-losartan', personId: 'person-elena', name: 'Losartán', dose: '50 mg', frequency: '1 por día', doctor: 'Dr. Gómez', notes: 'Tomar por la mañana.', active: true },
    { id: 'med-bisoprolol', personId: 'person-elena', name: 'Bisoprolol', dose: '5 mg', frequency: '1 por día', doctor: 'Dra. Pérez', notes: '', active: true },
    { id: 'med-omeprazol', personId: 'person-elena', name: 'Omeprazol', dose: '20 mg', frequency: 'Según indicación', doctor: 'Dr. Gómez', notes: 'Tratamiento finalizado.', active: false },
  ],
  tasks: [
    { id: 'task-eco', personId: 'person-elena', title: 'Conseguir turno para ecografía', dueDate: '2026-08-30', priority: 'Urgente', status: 'Pendiente', notes: 'Consultar disponibilidad por la mañana.' },
    { id: 'task-bisoprolol', personId: 'person-elena', title: 'Retirar Bisoprolol', dueDate: '2026-08-31', priority: 'Importante', status: 'Pendiente', notes: '' },
    { id: 'task-receta', personId: 'person-elena', title: 'Pedir nueva receta de Losartán', dueDate: '2026-09-05', priority: 'Normal', status: 'Pendiente', notes: '' },
    { id: 'task-analisis', personId: 'person-elena', title: 'Buscar resultado del análisis', dueDate: '', priority: 'Normal', status: 'Completado', notes: '' },
  ],
};
