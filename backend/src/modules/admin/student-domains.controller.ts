/**
 * /api/v1/admin/student-domains — admin-only allow/deny list for the Student badge (FR-004, PRD Q5).
 *
 *   GET  /admin/student-domains   → StudentDomainDto[] (sorted by domain)
 *   POST /admin/student-domains   upsertStudentDomainSchema → StudentDomainDto (create or update)
 *
 * `allowed: true`  accepts a college domain that has no .ac.in/.edu/.edu.in suffix (and names the college).
 * `allowed: false` blocks a domain even if its suffix would be accepted.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { upsertStudentDomainSchema, type StudentDomainDto, type UpsertStudentDomainInput } from '@cc/shared';
import type { StudentDomain } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Roles } from '../auth/auth.decorators.js';

function toDto(row: StudentDomain): StudentDomainDto {
  return { domain: row.domain, collegeName: row.collegeName, allowed: row.allowed, createdAt: row.createdAt.toISOString() };
}

@Roles('ADMIN')
@Controller('admin/student-domains')
export class StudentDomainsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<StudentDomainDto[]> {
    const rows = await this.prisma.studentDomain.findMany({ orderBy: { domain: 'asc' } });
    return rows.map(toDto);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async upsert(@Body({ schema: upsertStudentDomainSchema }) body: UpsertStudentDomainInput): Promise<StudentDomainDto> {
    const row = await this.prisma.studentDomain.upsert({
      where: { domain: body.domain },
      create: body,
      update: { collegeName: body.collegeName, allowed: body.allowed },
    });
    return toDto(row);
  }
}
