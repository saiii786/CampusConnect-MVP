/**
 * Dispute resolution (FR-601, ADR-012) — `@Roles('ADMIN')`:
 *
 *   GET  /admin/disputes?status=OPEN|RESOLVED_REFUND|RESOLVED_RELEASE → AdminDisputeDto[]
 *   POST /admin/disputes/:orderId/resolve  { resolution: REFUND|RELEASE, note }
 *        REFUND  → order CANCELLED, escrow back to the buyer
 *        RELEASE → order COMPLETED, escrow to the seller
 * Goes through OrdersService.transition() (state machine + escrow in one transaction), then marks
 * the dispute resolved. Both people are notified.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  idParamSchema,
  OrderAction,
  OrderActor,
  OrderStatus,
  resolveDisputeSchema,
  type AdminDisputeDto,
  type ResolveDisputeInput,
} from '@cc/shared';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import { OrdersService } from '../orders/orders.service.js';

const disputesQuerySchema = z.object({ status: z.enum(['OPEN', 'RESOLVED_REFUND', 'RESOLVED_RELEASE']).optional() }).strict();
type DisputesQuery = z.infer<typeof disputesQuerySchema>;

@Roles('ADMIN')
@Controller('admin/disputes')
export class AdminDisputesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  async list(@Query({ schema: disputesQuerySchema }) query: DisputesQuery): Promise<AdminDisputeDto[]> {
    const party = { select: { id: true, profile: { select: { displayName: true } } } } as const;
    const rows = await this.prisma.dispute.findMany({
      where: { status: query.status ?? 'OPEN' },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { order: { include: { buyer: party, seller: party } }, raisedBy: party },
    });
    return rows.map((d) => ({
      orderId: d.orderId,
      orderTitle: d.order.title,
      amountPaise: d.order.amountPaise,
      paymentMode: d.order.paymentMode,
      orderStatus: d.order.status,
      reason: d.reason,
      status: d.status,
      raisedBy: {
        id: d.raisedBy.id,
        displayName: d.raisedBy.profile?.displayName ?? '',
        role: d.raisedById === d.order.buyerId ? 'BUYER' : 'SELLER',
      },
      buyer: { id: d.order.buyer.id, displayName: d.order.buyer.profile?.displayName ?? '' },
      seller: { id: d.order.seller.id, displayName: d.order.seller.profile?.displayName ?? '' },
      createdAt: d.createdAt.toISOString(),
    }));
  }

  @Post(':orderId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(
    @CurrentUser() admin: AuthUser,
    @Param('orderId', { schema: idParamSchema }) orderId: string,
    @Body({ schema: resolveDisputeSchema }) body: ResolveDisputeInput,
  ): Promise<{ orderId: string; status: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    const dispute = await this.prisma.dispute.findUnique({ where: { orderId } });
    if (!order || !dispute) throw AppError.notFound('DISPUTE_NOT_FOUND', 'No dispute for this order');
    if (order.status !== OrderStatus.DISPUTED || dispute.status !== 'OPEN') {
      throw AppError.conflict('DISPUTE_ALREADY_RESOLVED', 'This dispute is already resolved');
    }
    const action = body.resolution === 'REFUND' ? OrderAction.RESOLVE_REFUND : OrderAction.RESOLVE_RELEASE;
    await this.orders.transition(order, action, OrderActor.ADMIN, admin.id, body.note);
    await this.prisma.dispute.update({
      where: { orderId },
      data: {
        status: body.resolution === 'REFUND' ? 'RESOLVED_REFUND' : 'RESOLVED_RELEASE',
        resolvedById: admin.id,
        resolutionNote: body.note,
        resolvedAt: new Date(),
      },
    });
    return { orderId, status: body.resolution === 'REFUND' ? OrderStatus.CANCELLED : OrderStatus.COMPLETED };
  }
}
