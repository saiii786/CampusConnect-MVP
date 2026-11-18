/**
 * Password hashing with argon2id (OWASP recommended: m=19 MiB, t=2, p=1 — the library defaults,
 * asserted in password-hasher.spec.ts). Uses @node-rs/argon2: prebuilt binaries, no compiler needed.
 *
 * `verifyDummy` lets login spend the same time whether or not the email exists, so response
 * timing does not reveal which emails have accounts.
 */
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** argon2id (the numeric value of the library's const enum Algorithm.Argon2id). */
const ARGON2ID = 2;

@Injectable()
export class PasswordHasher {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, { algorithm: ARGON2ID });
  }

  /** True only if `password` matches `passwordHash`. Malformed hashes return false, never throw. */
  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Burn the same CPU as a real verification. Always resolves false. */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-equalisation');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
