/**
 * Rate-limit guard for HTTP routes only. The stock ThrottlerGuard reads the HTTP request (IP),
 * which does not exist for socket.io events; sockets are authenticated at connect time and
 * clients never send data-changing events over them (writes are REST).
 */
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType() !== 'http' || super.shouldSkip(context);
  }
}
