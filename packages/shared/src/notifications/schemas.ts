/**
 * In-app notifications and push tokens (PRD FR-550, FR-551).
 */
import { z } from 'zod';

export const NotificationType = {
  MESSAGE_NEW: 'MESSAGE_NEW',
  QUOTE_NEW: 'QUOTE_NEW',
  QUOTE_ACCEPTED: 'QUOTE_ACCEPTED',
  BOOKING_REQUEST: 'BOOKING_REQUEST',
  ORDER_STATUS: 'ORDER_STATUS',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  TOPUP_PAID: 'TOPUP_PAID',
  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Where tapping a notification takes the user. */
export type NotificationLink =
  | { kind: 'order'; id: string }
  | { kind: 'conversation'; id: string }
  | { kind: 'listing'; id: string }
  | { kind: 'quotes'; id: string }
  | { kind: 'wallet' }
  | { kind: 'profile' };

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: NotificationLink | null;
  read: boolean;
  createdAt: string;
}

/** POST /notifications/read — mark some (ids) or all (omit ids) as read. */
export const markNotificationsReadSchema = z
  .object({ ids: z.array(z.uuid()).min(1).max(100).optional() })
  .strict();
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

/** POST /me/push-tokens and DELETE /me/push-tokens (Expo push token of this device). */
export const pushTokenSchema = z
  .object({
    token: z.string().regex(/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/, 'Not an Expo push token'),
    platform: z.enum(['ios', 'android']).optional(),
  })
  .strict();
export type PushTokenInput = z.infer<typeof pushTokenSchema>;
