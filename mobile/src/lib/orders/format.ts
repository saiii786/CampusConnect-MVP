/**
 * Human labels for order statuses, actions and timeline entries.
 */
import { isActiveOrderStatus, type OrderActor, type OrderStatus, type UserOrderAction } from '@cc/shared';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  REQUESTED: 'Waiting for seller',
  AWAITING_PAYMENT: 'Waiting for payment',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Work submitted',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DECLINED: 'Declined',
  DISPUTED: 'In dispute',
};

export const ORDER_ACTION_LABEL: Record<UserOrderAction, string> = {
  accept: 'Accept booking',
  decline: 'Decline',
  cancel: 'Cancel order',
  fund: 'Pay into escrow',
  submit: 'Mark work as done',
  approve: 'Approve & complete',
  'request-changes': 'Ask for changes',
  dispute: 'Report a problem',
};

/** Order the buttons: positive first, destructive last. */
export const ACTION_ORDER: UserOrderAction[] = ['accept', 'fund', 'submit', 'approve', 'request-changes', 'decline', 'cancel', 'dispute'];

export const DESTRUCTIVE_ACTIONS: ReadonlySet<UserOrderAction> = new Set(['decline', 'cancel', 'dispute']);

const TIMELINE_LABEL: Record<string, string> = {
  book: 'booked the service',
  'accept-quote': 'accepted the quote',
  accept: 'accepted the booking',
  decline: 'declined the booking',
  cancel: 'cancelled the order',
  fund: 'paid into escrow',
  start: 'started the job (start code entered)',
  submit: 'marked the work as done',
  approve: 'approved the work',
  'request-changes': 'asked for changes',
  dispute: 'reported a problem',
  'auto-approve': 'Order approved automatically after 5 days',
  'resolve-refund': 'Dispute resolved: buyer refunded',
  'resolve-release': 'Dispute resolved: seller paid',
};

/** "You accepted the booking" / "Seller marked the work as done" / system/admin sentences. */
export function timelineText(action: string, actorRole: OrderActor, myRole: 'BUYER' | 'SELLER'): string {
  const label = TIMELINE_LABEL[action] ?? action;
  if (actorRole === 'SYSTEM' || actorRole === 'ADMIN') return label;
  const who = actorRole === myRole ? 'You' : actorRole === 'BUYER' ? 'Buyer' : 'Seller';
  return `${who} ${label}`;
}

/** Same rule as the server's `scope=active` (shared). */
export const isActiveStatus = (status: OrderStatus): boolean => isActiveOrderStatus(status);
