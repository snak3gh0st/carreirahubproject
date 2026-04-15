import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { AiWorkspace } from '@/components/ai/AiWorkspace';
import { authOptions } from '@/lib/auth';
import { AI_HUBS, isRoleAllowedForHub } from '@/lib/ai/hub-config';

export default async function AdminAiPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  const role = String((session.user as any)?.role ?? '');
  if (!isRoleAllowedForHub(role, 'admin')) {
    redirect('/dashboard');
  }

  return <AiWorkspace hub={AI_HUBS.ADMIN_EXECUTIVE} />;
}
