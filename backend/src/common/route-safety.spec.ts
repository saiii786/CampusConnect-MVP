/**
 * Route safety net (ROADMAP T1.9, NFR-01). Scans EVERY controller in src/ and fails if:
 *
 *   1. any @Body / @Query / @Param parameter has no zod schema — an unvalidated parameter is
 *      silently accepted as-is (the old demo-connect bug that allowed negative prices);
 *   2. the set of @Public() routes differs from the reviewed list below — making a route public
 *      must be a deliberate, reviewed change (update PUBLIC_ROUTES in the same commit);
 *   3. any route under /admin is not `@Roles('ADMIN')` (or is public).
 *
 * New controllers are picked up automatically (glob below); no registration needed.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../modules/auth/auth.decorators.js';

/** Reviewed list of routes reachable without signing in. Keep sorted. */
const PUBLIC_ROUTES = [
  'GET /categories',
  'GET /health',
  'GET /payments/fake/:id', // fake gateway only; HMAC token in the query is the credential
  'GET /payments/return', // static "go back to the app" page after a gateway checkout
  'GET /uploads/files/*key', // local storage driver only (404 with Supabase)
  'GET /users/:id/work-record', // FR-053: shareable verified work record (no contact details)
  'GET /work-record/:id', // FR-053: the same as an HTML page
  'POST /auth/forgot-password',
  'POST /auth/login',
  'POST /auth/logout',
  'POST /auth/refresh',
  'POST /auth/reset-password',
  'POST /auth/signup',
  'POST /payments/fake/:id/cancel', // fake gateway only; token-protected
  'POST /payments/fake/:id/pay', // fake gateway only; token-protected
  'POST /webhooks/razorpay', // authenticated by the X-Razorpay-Signature HMAC
  'PUT /uploads/local/:token', // local storage driver only; the signed upload token is the credential
];

const VALIDATED_PARAM_TYPES = new Set<number>([RouteParamtypes.BODY, RouteParamtypes.QUERY, RouteParamtypes.PARAM]);

type Ctor = abstract new (...args: never[]) => unknown;

interface RouteInfo {
  route: string;
  controller: string;
  handler: string;
  isPublic: boolean;
  roles: string[];
  unvalidated: string[];
}

function joinPath(...parts: string[]): string {
  const joined = parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `/${joined}`;
}

function collectRoutes(controllers: Ctor[]): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const controller of controllers) {
    const basePath = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
    const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue; // not a route handler

      const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
      const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) ?? {}) as Record<
        string,
        { index: number; data?: unknown; schema?: unknown }
      >;
      const unvalidated = Object.entries(args)
        .filter(([key]) => {
          const [type] = key.split(':');
          return VALIDATED_PARAM_TYPES.has(Number(type)) && !key.includes('__customRouteArgs__');
        })
        .filter(([, meta]) => meta.schema === undefined)
        .map(([key, meta]) => {
          const name = typeof meta.data === 'string' ? meta.data : '';
          return `${RouteParamtypes[Number(key.split(':')[0])]}(${name}) #${meta.index}`;
        });

      routes.push({
        route: `${RequestMethod[method]} ${joinPath(basePath, path)}`,
        controller: controller.name,
        handler: name,
        isPublic: classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
        roles: ((Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, controller) ?? []) as string[]),
        unvalidated,
      });
    }
  }
  return routes;
}

// Every *.controller.ts under src/ (generated code excluded).
const srcDir = fileURLToPath(new URL('..', import.meta.url));
const controllerFiles = readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter(
  (file) => file.endsWith('.controller.ts') && !file.includes('generated'),
);
const modules = (await Promise.all(
  controllerFiles.map((file) => import(pathToFileURL(join(srcDir, file)).href)),
)) as Record<string, unknown>[];
const controllers = modules
  .flatMap((mod) => Object.values(mod))
  .filter((value): value is Ctor => typeof value === 'function' && Reflect.hasMetadata(PATH_METADATA, value));
const routes = collectRoutes(controllers);

describe('route safety (T1.9)', () => {
  it('finds the controllers', () => {
    expect(controllers.length).toBeGreaterThanOrEqual(3);
    expect(routes.map((r) => r.route)).toContain('POST /auth/signup');
  });

  it('every @Body / @Query / @Param parameter declares a zod schema', () => {
    const offenders = routes
      .filter((r) => r.unvalidated.length > 0)
      .map((r) => `${r.route} (${r.controller}.${r.handler}): ${r.unvalidated.join(', ')}`);
    expect(offenders).toEqual([]);
  });

  it('public routes match the reviewed list exactly', () => {
    const actual = routes
      .filter((r) => r.isPublic)
      .map((r) => r.route)
      .sort();
    expect(actual).toEqual(PUBLIC_ROUTES);
  });

  it('every /admin route is admin-only and none is public', () => {
    const admin = routes.filter((r) => r.route.split(' ')[1]!.startsWith('/admin'));
    expect(admin.length).toBeGreaterThanOrEqual(10);
    const offenders = admin.filter((r) => r.isPublic || !r.roles.includes('ADMIN')).map((r) => r.route);
    expect(offenders).toEqual([]);
  });

  it('detects an unvalidated parameter (self-test of this checker)', async () => {
    const { Body, Controller, Post } = await import('@nestjs/common');
    @Controller('bad')
    class BadController {
      @Post()
      create(@Body() body: unknown) {
        return body;
      }
    }
    const [bad] = collectRoutes([BadController]);
    expect(bad?.unvalidated).toEqual(['BODY() #0']);
  });
});
