/**
 * Integration-test helpers for accounts and uploads.
 *
 *   const alice = await createUser(app);            // signed up + signed in
 *   const key = await uploadImage(app, alice, 'AVATAR');
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { AuthSessionResponse, UploadPurpose, UploadTarget } from '@cc/shared';

export const TEST_PASSWORD = 'correct horse battery';

/** Smallest byte sequence our image check accepts as a JPEG (header + padding). */
export const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array<number>(60).fill(0)]);

export interface TestUser {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
  auth: { Authorization: string };
}

let counter = 0;

export async function createUser(app: INestApplication<App>, name = 'Test User'): Promise<TestUser> {
  const email = `u${++counter}.${Date.now()}@example.com`;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/signup')
    .send({ email, password: TEST_PASSWORD, displayName: name, dateOfBirth: '2000-01-15', acceptTerms: true })
    .expect(201);
  const body = res.body as AuthSessionResponse;
  return {
    id: body.user.id,
    email,
    token: body.tokens.accessToken,
    refreshToken: body.tokens.refreshToken,
    auth: { Authorization: `Bearer ${body.tokens.accessToken}` },
  };
}

/** Sign an upload and send the bytes (local storage driver). Returns the upload key. */
export async function uploadImage(
  app: INestApplication<App>,
  user: TestUser,
  purpose: UploadPurpose,
  bytes: Buffer = JPEG_BYTES,
): Promise<string> {
  const server = app.getHttpServer();
  const sign = await request(server)
    .post('/api/v1/uploads/sign')
    .set(user.auth)
    .send({ purpose, contentType: 'image/jpeg', sizeBytes: bytes.length })
    .expect(200);
  const target = sign.body as UploadTarget;
  await request(server).put(target.uploadUrl).set(target.headers).send(bytes).expect(200);
  return target.key;
}
