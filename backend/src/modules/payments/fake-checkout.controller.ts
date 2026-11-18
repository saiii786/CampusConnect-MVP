/**
 * Fake checkout pages (PAYMENT_GATEWAY=fake only; 404 otherwise) + the "payment finished" page
 * Razorpay redirects to. Plain HTML forms, no scripts (works with helmet's CSP).
 *
 *   GET  /payments/fake/:id?token=…          page with "Pay ₹X (test)" and "Cancel"
 *   POST /payments/fake/:id/pay?token=…      marks the fake checkout paid → wallet credited
 *   POST /payments/fake/:id/cancel?token=…   marks it failed
 *   GET  /payments/return                    "You can go back to the app"
 * The token is an HMAC of the payment id, so only the person who started the top-up has the link.
 */
import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { formatPaise, idParamSchema } from '@cc/shared';
import { z } from 'zod';
import { Public } from '../auth/auth.decorators.js';
import { PaymentsService } from './payments.service.js';

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#17141F}
.badge{display:inline-block;background:#FEF0C7;color:#93370D;padding:4px 10px;border-radius:999px;font-weight:600;font-size:13px}
button{width:100%;min-height:48px;font-size:17px;border-radius:10px;border:0;margin-top:12px}
.pay{background:#6D28D9;color:#fff}.cancel{background:#EDE7FB;color:#6D28D9}</style></head>
<body><p class="badge">TEST MODE — no real money</p>${body}</body></html>`;
}

@Public()
@Controller('payments')
export class FakeCheckoutController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('fake/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async checkout(@Param('id', { schema: idParamSchema }) id: string, @Query('token', { schema: tokenSchema }) token: string): Promise<string> {
    const p = await this.payments.findByFakeToken(id, token);
    if (p.status !== 'CREATED') return page('Payment', `<h1>Payment ${p.status.toLowerCase()}</h1><p>You can go back to the app.</p>`);
    const q = `?token=${encodeURIComponent(token)}`;
    return page(
      'Fake checkout',
      `<h1>Add ${formatPaise(p.amountPaise)}</h1><p>This is the development checkout. Pressing Pay adds test money to your CampusConnect wallet.</p>
<form method="post" action="/api/v1/payments/fake/${id}/pay${q}"><button class="pay" type="submit">Pay ${formatPaise(p.amountPaise)} (test)</button></form>
<form method="post" action="/api/v1/payments/fake/${id}/cancel${q}"><button class="cancel" type="submit">Cancel</button></form>`,
    );
  }

  @Post('fake/:id/pay')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async pay(@Param('id', { schema: idParamSchema }) id: string, @Query('token', { schema: tokenSchema }) token: string): Promise<string> {
    const p = await this.payments.completeFake(id, token, 'paid');
    return page('Paid', `<h1>${p.status === 'PAID' ? 'Payment successful' : `Payment ${p.status.toLowerCase()}`}</h1><p>You can close this page and go back to the app.</p>`);
  }

  @Post('fake/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async cancel(@Param('id', { schema: idParamSchema }) id: string, @Query('token', { schema: tokenSchema }) token: string): Promise<string> {
    await this.payments.completeFake(id, token, 'failed');
    return page('Cancelled', '<h1>Payment cancelled</h1><p>No money was added. You can go back to the app.</p>');
  }

  @Get('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  done(): string {
    return page('Done', '<h1>Payment finished</h1><p>Go back to the CampusConnect app — your wallet updates in a few seconds.</p>');
  }
}
