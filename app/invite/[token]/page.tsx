import { AuthShell } from '@/components/auth-shell';
import { InvitationPage } from '@/components/invitation-page';

export default async function InviteRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <AuthShell>
      <InvitationPage token={(await params).token} />
    </AuthShell>
  );
}
