/**
 * Notification Service -- Re-export from consolidated email service
 *
 * All email/notification functionality has been consolidated into
 * `email.service.ts` (Resend SDK + circuit breaker + Notification DB logging).
 *
 * This file exists for backward compatibility with existing imports:
 *   import { notificationService } from '@/lib/services/notification.service';
 *   import { NotificationService } from '@/lib/services/notification.service';
 */

export {
  emailService as notificationService,
  EmailService as NotificationService,
} from './email.service';
