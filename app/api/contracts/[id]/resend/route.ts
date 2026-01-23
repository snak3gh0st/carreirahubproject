import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { contractWorkflowService } from '@/lib/services/contract-workflow.service';

/**
 * POST /api/contracts/[id]/resend
 * Manually resend contract reminder
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        invoice: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Only allow resend for pending contracts
    if (contract.status !== 'SENT_FOR_SIGNATURE' && contract.status !== 'VIEWED') {
      return NextResponse.json(
        { error: `Cannot resend reminder for ${contract.status} contract` },
        { status: 400 }
      );
    }

    // Send reminder
    await contractWorkflowService.sendReminderForContract(contract);

    // Log the action
    await prisma.integrationLog.create({
      data: {
        service: 'CONTRACTS',
        action: 'MANUAL_REMINDER_SENT',
        status: 'SUCCESS',
        payload: {
          contractId: contract.id,
          sentBy: session.user?.email,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Reminder sent successfully',
      reminderCount: contract.reminderCount + 1,
    });

  } catch (error) {
    console.error('[API_CONTRACT_RESEND] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send reminder' },
      { status: 500 }
    );
  }
}
