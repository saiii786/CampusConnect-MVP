import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from '../../config/env.js';
import { LocalStorageService } from './local-storage.service.js';
import { SupabaseStorageService } from './supabase-storage.service.js';

const UID = '01936b6e-7c3a-7d4e-8f00-0123456789ab';
const KEY = `users/${UID}/avatar/01936b6e-7c3a-7d4e-8f00-0123456789ac.jpg`;
const BASE_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  CODE_HASH_SECRET: 'b'.repeat(32),
};

describe('LocalStorageService', () => {
  let dir: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cc-storage-'));
    storage = new LocalStorageService(loadEnv({ ...BASE_ENV, STORAGE_LOCAL_DIR: dir }));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('issues a signed upload token that round-trips', async () => {
    const target = await storage.createUploadTarget(KEY, 'image/jpeg', 5_000_000);
    expect(target.uploadUrl).toMatch(/^\/api\/v1\/uploads\/local\//);
    expect(target.headers['Content-Type']).toBe('image/jpeg');
    const token = target.uploadUrl.split('/').pop()!;
    expect(storage.verifyToken(token)).toEqual({ key: KEY, contentType: 'image/jpeg', maxBytes: 5_000_000 });
  });

  it('rejects tampered and expired tokens', async () => {
    const token = (await storage.createUploadTarget(KEY, 'image/jpeg', 100)).uploadUrl.split('/').pop()!;
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), m: 999_999_999 }),
    ).toString('base64url');
    expect(() => storage.verifyToken(`${forged}.${sig}`)).toThrow(expect.objectContaining({ code: 'UPLOAD_TOKEN_INVALID' }));
    expect(() => storage.verifyToken(token, Date.now() + 11 * 60 * 1000)).toThrow(
      expect.objectContaining({ code: 'UPLOAD_TOKEN_EXPIRED' }),
    );
  });

  it('writes, stats, serves path and deletes; refuses keys outside the folder', async () => {
    await storage.write(KEY, Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    expect(await storage.stat(KEY)).toEqual({ sizeBytes: 4, contentType: 'image/jpeg' });
    expect(storage.publicUrl(KEY)).toBe(`/api/v1/uploads/files/${KEY}`);
    await storage.delete([KEY]);
    expect(await storage.stat(KEY)).toBeNull();
    expect(() => storage.pathOf('../../etc/passwd')).toThrow();
    expect(() => storage.pathOf(`users/${UID}/avatar/../../x.jpg`)).toThrow();
  });
});

describe('SupabaseStorageService', () => {
  const env = loadEnv({
    ...BASE_ENV,
    STORAGE_DRIVER: 'supabase',
    SUPABASE_URL: 'https://proj.supabase.co/',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-0123456789',
    STORAGE_BUCKET: 'media',
  });

  it('signs uploads with the service key and returns an absolute upload URL', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ url: `/object/upload/sign/media/${KEY}?token=abc` }),
    ) as unknown as typeof fetch;
    const storage = new SupabaseStorageService(env, fetchImpl);
    const target = await storage.createUploadTarget(KEY, 'image/png');

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`https://proj.supabase.co/storage/v1/object/upload/sign/media/${KEY}`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer service-role-key-0123456789');
    expect(target.uploadUrl).toBe(`https://proj.supabase.co/storage/v1/object/upload/sign/media/${KEY}?token=abc`);
    expect(target.headers).toEqual({ 'Content-Type': 'image/png', 'x-upsert': 'false' });
    // The service key must never reach the app.
    expect(JSON.stringify(target)).not.toContain('service-role-key');
  });

  it('stat uses the public URL; missing objects → null', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { 'content-length': '1234', 'content-type': 'image/png' } }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }));
    const storage = new SupabaseStorageService(env, fetchImpl as unknown as typeof fetch);
    expect(await storage.stat(KEY)).toEqual({ sizeBytes: 1234, contentType: 'image/png' });
    expect(fetchImpl.mock.calls[0]![0]).toBe(`https://proj.supabase.co/storage/v1/object/public/media/${KEY}`);
    expect(await storage.stat(KEY)).toBeNull();
  });

  it('deletes by prefix list; signing failures throw', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response('nope', { status: 500 }));
    const storage = new SupabaseStorageService(env, fetchImpl as unknown as typeof fetch);
    await storage.delete([KEY]);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ method: 'DELETE', body: JSON.stringify({ prefixes: [KEY] }) });
    await expect(storage.createUploadTarget(KEY, 'image/png')).rejects.toThrow();
  });
});
