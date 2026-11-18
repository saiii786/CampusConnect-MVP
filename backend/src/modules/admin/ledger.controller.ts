/**
 * GET /api/v1/admin/ledger/reconcile — admin only. Proves the money is consistent:
 * every wallet's cached balance equals the sum of its ledger entries, every ledger transaction
 * sums to zero, and no finished order still holds escrow (FR-450, NFR-04).
 */
import { Controller, Get } from '@nestjs/common';
import type { LedgerReconcileDto } from '@cc/shared';
import { Roles } from '../auth/auth.decorators.js';
import { LedgerService } from '../wallet/ledger.service.js';

@Roles('ADMIN')
@Controller('admin/ledger')
export class AdminLedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('reconcile')
  reconcile(): Promise<LedgerReconcileDto> {
    return this.ledger.reconcile();
  }
}
