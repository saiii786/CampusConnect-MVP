import { OrderStatus, USER_ORDER_ACTIONS } from '@cc/shared';
import { ACTION_ORDER, isActiveStatus, ORDER_ACTION_LABEL, ORDER_STATUS_LABEL, timelineText } from './format';

describe('order labels', () => {
  it('every user action has a label and a button position; every status has a label', () => {
    for (const action of USER_ORDER_ACTIONS) {
      expect(ORDER_ACTION_LABEL[action]).toBeTruthy();
      expect(ACTION_ORDER).toContain(action);
    }
    for (const status of Object.values(OrderStatus)) expect(ORDER_STATUS_LABEL[status]).toBeTruthy();
  });

  it('timeline sentences depend on who acted and who is reading', () => {
    expect(timelineText('accept', 'SELLER', 'SELLER')).toBe('You accepted the booking');
    expect(timelineText('accept', 'SELLER', 'BUYER')).toBe('Seller accepted the booking');
    expect(timelineText('book', 'BUYER', 'SELLER')).toBe('Buyer booked the service');
    expect(timelineText('auto-approve', 'SYSTEM', 'BUYER')).toBe('Order approved automatically after 5 days');
    expect(timelineText('something-new', 'BUYER', 'BUYER')).toBe('You something-new');
  });

  it('active vs finished statuses', () => {
    expect(isActiveStatus('IN_PROGRESS')).toBe(true);
    expect(isActiveStatus('DISPUTED')).toBe(true);
    expect(isActiveStatus('COMPLETED')).toBe(false);
    expect(isActiveStatus('DECLINED')).toBe(false);
  });
});
