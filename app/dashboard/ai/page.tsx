import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getAiRouteForRole } from '@/lib/ai/hub-config';

export default async function AiPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  const role = String((session.user as any)?.role ?? '');
  const route = getAiRouteForRole(role);

  redirect(route ?? '/dashboard');
}
