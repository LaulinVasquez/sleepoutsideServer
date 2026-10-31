import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { globalErrorHandler } from '../../src/middleware/error.middleware.mts';
import authorize from '../../src/middleware/authorize.mts';
import CustomError from '../../src/errors/CustomError.mts';
import type { AddressInfo } from 'node:net';

async function request(path: string, authorization?: string) {
  const app = express();
  app.use(express.json());
  app.get('/protected', authorize, (_req, res) => { res.json({ ok: true }); });
  app.get('/crash', () => { throw new Error('private database credentials'); });
  app.use((_req, _res, next) => next(new CustomError({ statusCode: 404, message: 'Not found' })));
  app.use(globalErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      headers: authorization ? { Authorization: authorization } : {},
    });
    return { status: response.status, body: await response.json() as { error: { redirectTo: string; statusCode: number } } };
  } finally { server.close(); }
}

afterEach(() => vi.unstubAllEnvs());
describe('global route errors', () => {
  it('preserves 404 and supplies navigation metadata', async () => {
    const result = await request('/missing');
    expect(result.status).toBe(404);
    expect(result.body.error).toMatchObject({ statusCode: 404, redirectTo: '/404', flash: { type: 'error' } });
  });
  it('masks unexpected errors', async () => {
    const result = await request('/crash');
    expect(result.status).toBe(500);
    expect(result.body.error.redirectTo).toBe('/500');
    expect(JSON.stringify(result.body)).not.toContain('credentials');
  });
  it.each([undefined, 'Basic abc', 'Bearer invalid', 'Bearer abc extra'])('returns 401 for invalid authorization %s', async (header) => {
    vi.stubEnv('JWT_SECRET', 'test-secret');
    const result = await request('/protected', header);
    expect(result.status).toBe(401);
    expect(result.body.error.redirectTo).toBe('/401');
  });
  it('returns 401 for expired tokens and permits valid tokens', async () => {
    vi.stubEnv('JWT_SECRET', 'test-secret');
    expect((await request('/protected', `Bearer ${jwt.sign({}, 'test-secret', { expiresIn: -1 })}`)).status).toBe(401);
    expect((await request('/protected', `Bearer ${jwt.sign({}, 'test-secret')}`)).status).toBe(200);
  });
  it('delegates when headers have already been sent', () => {
    const next = vi.fn();
    const error = new Error('stream failed');
    globalErrorHandler(error, {} as any, { headersSent: true } as any, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
