/**
 * /api/v1/wallet — balance, history, test-mode top-ups and simulated withdrawals (FR-450…455).
 *
 * | Endpoint                          | Body / query          | Success |
 * |-----------------------------------|-----------------------|---------|
 * | GET  /wallet                      | —                     | 200 WalletDto (balance, in escrow, testMode) |
 * | GET  /wallet/transactions         | cursor?, limit?       | 200 Page<WalletTransactionDto> |
 * | POST /wallet/topups               | { amountPaise }       | 201 TopupDto (open checkoutUrl) |
 * | GET  /wallet/topups/:id           | —                     | 200 TopupDto |
 * | POST /wallet/topups/:id/verify    | —                     | 200 TopupDto (server asks the gateway) |
 * | POST /wallet/withdrawals          | { amountPaise }       | 201 WithdrawalDto (SIMULATED) |
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  createTopupSchema,
  createWithdrawalSchema,
  idParamSchema,
  pageQuerySchema,
  type CreateTopupInput,
  type CreateWithdrawalInput,
  type Page,
  type PageQuery,
  type TopupDto,
  type WalletDto,
  type WalletTransactionDto,
  type WithdrawalDto,
} from '@cc/shared';
import { AuthRateLimit, CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { PaymentsService } from '../payments/payments.service.js';
import { WalletService } from './wallet.service.js';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<WalletDto> {
    return this.wallet.getWallet(user.id);
  }

  @Get('transactions')
  transactions(@CurrentUser() user: AuthUser, @Query({ schema: pageQuerySchema }) query: PageQuery): Promise<Page<WalletTransactionDto>> {
    return this.wallet.transactions(user.id, query);
  }

  @AuthRateLimit()
  @Post('topups')
  @HttpCode(HttpStatus.CREATED)
  topup(@CurrentUser() user: AuthUser, @Body({ schema: createTopupSchema }) body: CreateTopupInput): Promise<TopupDto> {
    return this.payments.createTopup(user.id, body);
  }

  @Get('topups/:id')
  getTopup(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<TopupDto> {
    return this.payments.get(user.id, id);
  }

  @Post('topups/:id/verify')
  @HttpCode(HttpStatus.OK)
  verify(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<TopupDto> {
    return this.payments.verify(user.id, id);
  }

  @AuthRateLimit()
  @Post('withdrawals')
  @HttpCode(HttpStatus.CREATED)
  withdraw(@CurrentUser() user: AuthUser, @Body({ schema: createWithdrawalSchema }) body: CreateWithdrawalInput): Promise<WithdrawalDto> {
    return this.wallet.withdraw(user.id, body);
  }
}
