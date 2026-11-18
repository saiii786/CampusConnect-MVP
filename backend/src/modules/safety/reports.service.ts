/**
 * Reports (FR-600) and their moderation (FR-601).
 *
 * Users report a USER, LISTING, MESSAGE or REVIEW they can see. One OPEN report per reporter per
 * target (repeats return the existing one). Admins list reports with a short description of the
 * target and resolve them: DISMISS, or ACTION with optional "hide content" and/or "suspend the
 * person responsible":
 *   listing → CLOSED + deletedAt (gone from search) · message/review → hiddenAt (shown as removed /
 *   excluded from ratings) · user → no content to hide.
 */
import { Injectable } from '@nestjs/common';
import {
  ReportStatus,
  UserStatus,
  type AdminReportDto,
  type AdminReportsQuery,
  type CreateReportInput,
  type ReportDto,
  type ResolveReportInput,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import type { Report } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

function toReportDto(r: Report): ReportDto {
  return {
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

const targetNotFound = () => AppError.notFound('REPORT_TARGET_NOT_FOUND', 'What you are reporting was not found');

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /reports */
  async create(reporterId: string, input: CreateReportInput): Promise<ReportDto> {
    const ownerId = await this.targetOwner(reporterId, input.targetType, input.targetId);
    if (ownerId === reporterId) throw AppError.unprocessable('CANNOT_REPORT_SELF', 'You cannot report yourself or your own content');

    const existing = await this.prisma.report.findFirst({
      where: { reporterId, targetType: input.targetType, targetId: input.targetId, status: ReportStatus.OPEN },
    });
    if (existing) return toReportDto(existing);
    const report = await this.prisma.report.create({
      data: { reporterId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details || null },
    });
    return toReportDto(report);
  }

  /** GET /admin/reports */
  async list(query: AdminReportsQuery): Promise<AdminReportDto[]> {
    const rows = await this.prisma.report.findMany({
      where: { status: query.status ?? ReportStatus.OPEN },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { reporter: { select: { id: true, profile: { select: { displayName: true } } } } },
    });
    return Promise.all(
      rows.map(async (r) => ({
        ...toReportDto(r),
        reporter: { id: r.reporter.id, displayName: r.reporter.profile?.displayName ?? '' },
        target: await this.describe(r.targetType, r.targetId),
        handledAt: r.handledAt?.toISOString() ?? null,
      })),
    );
  }

  /** POST /admin/reports/:id/resolve */
  async resolve(adminId: string, reportId: string, input: ResolveReportInput): Promise<ReportDto> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw AppError.notFound('REPORT_NOT_FOUND', 'Report not found');
    if (report.status !== ReportStatus.OPEN) throw AppError.conflict('REPORT_ALREADY_HANDLED', 'This report was already handled');

    const now = new Date();
    if (input.decision === 'ACTION') {
      const target = await this.describe(report.targetType, report.targetId);
      if (input.hideContent) {
        if (report.targetType === 'LISTING') {
          await this.prisma.listing.update({ where: { id: report.targetId }, data: { status: 'CLOSED', deletedAt: now } });
        } else if (report.targetType === 'MESSAGE') {
          await this.prisma.message.update({ where: { id: report.targetId }, data: { hiddenAt: now } });
        } else if (report.targetType === 'REVIEW') {
          await this.prisma.review.update({ where: { id: report.targetId }, data: { hiddenAt: now } });
        }
      }
      if (input.suspendUser && target.ownerId) await this.suspend(target.ownerId);
    }
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: input.decision === 'ACTION' ? ReportStatus.ACTIONED : ReportStatus.DISMISSED,
        handledById: adminId,
        handledAt: now,
        details: input.note ? `${report.details ?? ''}\n[admin] ${input.note}`.trim() : report.details,
      },
    });
    return toReportDto(updated);
  }

  /** Suspend: blocks every request at once (auth guard) and ends all sessions (FR-601). */
  async suspend(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    if (user.role === 'ADMIN') throw AppError.unprocessable('CANNOT_SUSPEND_ADMIN', 'Admins cannot be suspended here');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.SUSPENDED } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async unsuspend(userId: string): Promise<void> {
    const changed = await this.prisma.user.updateMany({ where: { id: userId, status: UserStatus.SUSPENDED }, data: { status: UserStatus.ACTIVE } });
    if (changed.count !== 1) throw AppError.notFound('USER_NOT_FOUND', 'No suspended user with this id');
  }

  /** Owner of a target the reporter can see; throws 404 if it does not exist or is not visible. */
  private async targetOwner(reporterId: string, type: CreateReportInput['targetType'], id: string): Promise<string> {
    switch (type) {
      case 'USER': {
        const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!u) throw targetNotFound();
        return u.id;
      }
      case 'LISTING': {
        const l = await this.prisma.listing.findUnique({ where: { id }, select: { ownerId: true } });
        if (!l) throw targetNotFound();
        return l.ownerId;
      }
      case 'MESSAGE': {
        // Only participants of the conversation can see (and report) a message.
        const m = await this.prisma.message.findFirst({
          where: { id, conversation: { OR: [{ buyerId: reporterId }, { sellerId: reporterId }] } },
          select: { senderId: true },
        });
        if (!m) throw targetNotFound();
        return m.senderId;
      }
      case 'REVIEW': {
        const r = await this.prisma.review.findUnique({ where: { id }, select: { reviewerId: true } });
        if (!r) throw targetNotFound();
        return r.reviewerId;
      }
    }
  }

  private async describe(type: string, id: string): Promise<{ summary: string; ownerId: string | null }> {
    if (type === 'USER') {
      const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true, status: true, profile: { select: { displayName: true } } } });
      return { summary: u ? `User "${u.profile?.displayName}" (${u.status})` : '(deleted)', ownerId: u?.id ?? null };
    }
    if (type === 'LISTING') {
      const l = await this.prisma.listing.findUnique({ where: { id }, select: { title: true, status: true, ownerId: true } });
      return { summary: l ? `Listing "${l.title}" (${l.status})` : '(deleted)', ownerId: l?.ownerId ?? null };
    }
    if (type === 'MESSAGE') {
      const m = await this.prisma.message.findUnique({ where: { id }, select: { body: true, senderId: true, hiddenAt: true } });
      return { summary: m ? `Message: "${m.body.slice(0, 200)}"${m.hiddenAt ? ' (hidden)' : ''}` : '(deleted)', ownerId: m?.senderId ?? null };
    }
    const r = await this.prisma.review.findUnique({ where: { id }, select: { rating: true, comment: true, reviewerId: true, hiddenAt: true } });
    return { summary: r ? `Review ${r.rating}★: "${r.comment ?? ''}"${r.hiddenAt ? ' (hidden)' : ''}` : '(deleted)', ownerId: r?.reviewerId ?? null };
  }
}
