import { MedicalOrganizer } from '@/components/medical-organizer';
import { AuthShell } from '@/components/auth-shell';

export default function Home() {
  return (
    <AuthShell>
      <MedicalOrganizer />
    </AuthShell>
  );
}
