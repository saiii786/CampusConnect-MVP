import { Logger } from '@nestjs/common';
import { BREVO_SEND_URL, BrevoMailService } from './brevo-mail.service.js';

const config = { apiKey: 'xkeysib-test-key-0123456789abcdef', fromEmail: 'hello@example.com', fromName: 'Connect' };
const message = { to: 'student@example.com', subject: '123456 is your Connect code', text: 'Your code is 123456' };

function fakeFetch(status: number, body: unknown = { messageId: '<abc@smtp-relay>' }) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

describe('BrevoMailService', () => {
  it('posts the message to Brevo with the API key header and verified sender', async () => {
    const fetch = fakeFetch(201);
    await new BrevoMailService(config, fetch as unknown as typeof globalThis.fetch).send(message);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(BREVO_SEND_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['api-key']).toBe(config.apiKey);
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { email: 'hello@example.com', name: 'Connect' },
      to: [{ email: 'student@example.com' }],
      subject: message.subject,
      textContent: message.text,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws on an error response and logs the status without the key or the message body', async () => {
    const logged: string[] = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation((m: unknown) => void logged.push(String(m)));
    const fetch = fakeFetch(401, { code: 'unauthorized', message: 'Key not found' });

    await expect(new BrevoMailService(config, fetch as unknown as typeof globalThis.fetch).send(message)).rejects.toThrow('HTTP 401');
    expect(logged.join('\n')).toContain('HTTP 401 (unauthorized: Key not found)');
    expect(logged.join('\n')).not.toContain(config.apiKey);
    expect(logged.join('\n')).not.toContain('123456');
  });
});
