import { authConfig, authError } from '@/lib/server-auth';

export async function GET() {
  try {
    return Response.json(authConfig());
  } catch (error) {
    return authError(error);
  }
}
