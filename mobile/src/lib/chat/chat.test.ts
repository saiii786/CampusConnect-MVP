import type { MessageDto } from '@cc/shared';
import { QueryClient } from '@tanstack/react-query';
import { socketOrigin } from '@/lib/realtime/realtime';
import { addMessageToCache, chatKeys } from './chat-api';
import { formatShortTime } from './format';

jest.mock('expo-secure-store', () => ({}));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('@/config/api-url', () => ({ getApiBaseUrl: () => 'http://test/api/v1' }));

/** gcTime: Infinity → no garbage-collection timers left running after the test. */
const newClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });

const msg = (id: string, body = id): MessageDto => ({ id, conversationId: 'c1', senderId: 'u', body, createdAt: '2026-11-18T10:00:00Z' });

describe('addMessageToCache', () => {
  it('prepends new messages once (sender gets them from REST and from the socket)', () => {
    const client = newClient();
    client.setQueryData(chatKeys.messages('c1'), { pages: [{ items: [msg('m1')], nextCursor: null }], pageParams: [undefined] });
    addMessageToCache(client, msg('m2'));
    addMessageToCache(client, msg('m2'));
    const data = client.getQueryData<{ pages: { items: MessageDto[] }[] }>(chatKeys.messages('c1'));
    expect(data!.pages[0]!.items.map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('does nothing for conversations that are not loaded', () => {
    const client = newClient();
    addMessageToCache(client, msg('m1'));
    expect(client.getQueryData(chatKeys.messages('c1'))).toBeUndefined();
  });
});

describe('helpers', () => {
  it('socketOrigin strips the API path', () => {
    expect(socketOrigin('http://192.168.1.5:3000/api/v1')).toBe('http://192.168.1.5:3000');
    expect(socketOrigin('https://api.example.com/api/v1')).toBe('https://api.example.com');
  });
  it('formatShortTime shows a time today and a date otherwise', () => {
    const now = new Date('2026-11-18T15:00:00');
    expect(formatShortTime(new Date('2026-11-18T09:05:00').toISOString(), now)).toMatch(/09:05|9:05/);
    expect(formatShortTime(new Date('2026-11-02T09:05:00').toISOString(), now)).toMatch(/2 Nov/);
  });
});
