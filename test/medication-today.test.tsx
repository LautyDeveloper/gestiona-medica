import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MedicationTodayPanel } from '@/components/medication-today';
import type { MedicationTodayData } from '@/lib/models';

const data: MedicationTodayData = {
  personId: '22222222-2222-4222-8222-222222222222',
  date: '2026-09-02',
  occurrences: [
    {
      id: 'dose:m1:2026-09-02T11:00:00.000Z',
      medicationId: '11111111-1111-4111-8111-111111111111',
      medicationName: 'Losartán',
      dose: '50 mg',
      scheduledFor: '2026-09-02T11:00:00.000Z',
      status: 'unrecorded',
      intake: null,
    },
  ],
  recentIntakes: [],
};

describe('tomas de hoy', () => {
  it('usa lenguaje neutral y registra la decisión explícita', async () => {
    const onRecord = vi.fn().mockResolvedValue(undefined);
    render(
      <MedicationTodayPanel data={data} onRecord={onRecord} onVoid={vi.fn()} />,
    );
    expect(screen.getByText('Sin registrar')).toBeInTheDocument();
    expect(
      screen.getByText(/no significa que una toma no haya ocurrido/i),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Registrar toma' }),
    );
    expect(onRecord).toHaveBeenCalledWith(data.occurrences[0], 'taken');
  });
});
