import { beforeEach, beforeAll, afterAll, it, expect, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { Server } from 'node:http';
const model = vi.hoisted(() => ({ getUserById: vi.fn(), getProductsByIds: vi.fn(), insertOne: vi.fn() }));
vi.mock('../../src/models/user.model.mts', () => ({ getUserById: model.getUserById }));
vi.mock('../../src/models/product.model.mts', () => ({ default: { getProductsByIds: model.getProductsByIds } }));
vi.mock('../../src/database/index.mts', () => ({ default: { getDb: () => ({ collection: () => ({ insertOne: model.insertOne }) }) } }));
import { createOrder } from '../../src/services/order.service.mts';
import routes from '../../src/routes/order.routes.mts';
import { globalErrorHandler } from '../../src/middleware/error.middleware.mts';
const id = '64b7f0c2a1b2c3d4e5f60718';
const product = { id: 'tent', name: 'Tent', listPrice: 20, finalPrice: 19.99, images: { primaryLarge: '/tent.png' }, url: '/tent', category: 'tents', colors: [], sizesAvailable: { size: [] } };
const item = { productId: 'tent', productName: 'Tent', price: 20, finalPrice: 19.99, productImageSrc: '/tent.png', productUrl: '/tent', productCategory: 'tents' };
const input = () => ({ userId: id, name: 'Test Buyer', cardNumber: '4242424242424242', cardCode: '123', cardExpiration: '12/99', shippingAddress: { street: '123 Main Street', city: 'Boise', state: 'ID', zipCode: '83701', country: 'US' }, orderItems: [{ ...item }], taxAmount: 1.2, shippingCost: 10, totalPrice: 31.19 });
beforeEach(() => {
  vi.clearAllMocks(); model.getUserById.mockResolvedValue({ _id: id }); model.getProductsByIds.mockResolvedValue([product]); model.insertOne.mockResolvedValue({ insertedId: 'order-id' });
});
it('persists authoritative item details and totals without payment credentials', async () => {
  const body = input(); body.orderItems[0]!.productName = 'Forged';
  const result = await createOrder(id, body);
  expect(result.order.totalPrice).toBe(31.19);
  expect(result.order.orderItems[0].productName).toBe('Tent');
  expect(model.insertOne.mock.calls[0]![0]).not.toHaveProperty('cardNumber');
  expect(JSON.stringify(result)).not.toContain('4242424242424242');
});
it('counts repeated cart entries as units for shipping and rounds tax', async () => {
  const body = input(); body.orderItems.push({ ...item }); Object.assign(body, { taxAmount: 2.4, shippingCost: 12, totalPrice: 54.38 });
  expect((await createOrder(id, body)).order.totalPrice).toBe(54.38);
});
it.each([
  ['totalPrice', 0], ['shippingCost', 0], ['taxAmount', 0], ['cardNumber', '1111111111111111'], ['cardExpiration', '01/20'], ['cardExpiration', '13/99'], ['cardCode', '12'], ['orderItems', []], ['shippingAddress', {}], ['name', ' '],
])('rejects invalid %s without persisting', async (key, value) => {
  await expect(createOrder(id, { ...input(), [key]: value })).rejects.toMatchObject({ statusCode: 400 }); expect(model.insertOne).not.toHaveBeenCalled();
});
it('rejects tampered prices and nonexistent products', async () => {
  const body = input(); body.orderItems[0]!.finalPrice = 1;
  await expect(createOrder(id, body)).rejects.toMatchObject({ statusCode: 400 });
  model.getProductsByIds.mockResolvedValue([]);
  await expect(createOrder(id, input())).rejects.toMatchObject({ statusCode: 400 });
});
it('rejects ordering for another user or deleted account', async () => {
  await expect(createOrder(id, { ...input(), userId: 'other' })).rejects.toMatchObject({ statusCode: 403 });
  model.getUserById.mockResolvedValue(null);
  await expect(createOrder(id, input())).rejects.toMatchObject({ statusCode: 401 });
});
it('accepts expiration through the end of the month only', async () => {
  const body = { ...input(), cardExpiration: '11/26' };
  await expect(createOrder(id, body, new Date('2026-11-30T23:59:59Z'))).resolves.toBeDefined();
  await expect(createOrder(id, body, new Date('2026-12-01T00:00:00Z'))).rejects.toMatchObject({ statusCode: 400 });
});
let server: Server, base: string;
beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  const app = express(); app.use(express.json()); app.use('/orders', routes); app.use(globalErrorHandler);
  server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${(server.address() as any).port}/orders/`;
});
afterAll(() => server?.close());
it('enforces auth and returns 201, 400 and safe 500 responses over HTTP', async () => {
  const post = (body: unknown, auth = true) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET!)}` } : {}) }, body: JSON.stringify(body) });
  expect((await post(input(), false)).status).toBe(401);
  expect((await post(input())).status).toBe(201);
  expect((await post({ ...input(), totalPrice: 1 })).status).toBe(400);
  model.insertOne.mockRejectedValue(new Error('private database details'));
  const failed = await post(input()); expect(failed.status).toBe(500); expect(await failed.text()).not.toContain('private database');
});
