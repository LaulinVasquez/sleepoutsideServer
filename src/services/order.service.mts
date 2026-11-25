import { ObjectId } from 'mongodb';
import type { JSONSchema7 } from 'json-schema';
import contract from '../../swaggerDesign.json' with { type: 'json' };
import { validator } from './utils.mts';
import products from '../models/product.model.mts';
import { getUserById } from '../models/user.model.mts';
import mongodb from '../database/index.mts';
import CustomError from '../errors/CustomError.mts';

const schema = structuredClone(contract.components.schemas.OrderCreateRequest);
// Reuse the served API contract with its local CartItem reference resolved.
schema.properties.orderItems.items = contract.components.schemas.CartItem as any;
function reject(message: string, statusCode = 400): never {
  throw new CustomError({ message, statusCode, code: 'ERR_ORDER' });
}
export async function createOrder(userId: string, body: unknown, now = new Date()) {
  if (typeof userId !== 'string' || !ObjectId.isValid(userId)) reject('Please sign in again.', 401);
  if (!body || typeof body !== 'object' || Array.isArray(body)) reject('An order is required.');
  validator(schema as JSONSchema7, body);
  const input = body as any;
  if (input.userId !== userId) reject('You can only order for your own account.', 403);
  if (!await getUserById(userId)) reject('Please sign in again.', 401);
  const [month, year] = input.cardExpiration.split('/').map(Number);
  if (Date.UTC(2000 + year, month, 1) <= now.getTime()) reject('Card expiration must be in the future.');
  const catalog = await products.getProductsByIds([...new Set<string>(input.orderItems.map((item: any) => item.productId))]);
  let subtotal = 0;
  const orderItems = input.orderItems.map((item: any) => {
    const product = catalog.find(product => product.id === item.productId);
    if (!product) reject(`Product ${item.productId} is unavailable.`);
    if (!Number.isFinite(product.finalPrice) || product.finalPrice < 0) reject('Product price is unavailable.', 500);
    const cents = Math.round(product.finalPrice * 100);
    if (item.finalPrice !== cents / 100 || item.price !== product.listPrice) reject(`Price for ${product.name} has changed. Refresh your cart.`);
    subtotal += cents;
    const color = item.productColor ? product.colors.find(color => color.colorCode === item.productColor.colorCode) : undefined;
    if (item.productColor && !color) reject(`Invalid color for ${product.name}.`);
    if (item.productSize && !Object.values(product.sizesAvailable).some(values => values.includes(item.productSize))) reject(`Invalid size for ${product.name}.`);
    return { productId: product.id, productName: product.name, price: product.listPrice, finalPrice: cents / 100,
      productImageSrc: product.images.primaryLarge, productUrl: product.url, productCategory: product.category,
      ...(color ? { productColor: { colorCode: color.colorCode } } : {}), ...(item.productSize ? { productSize: item.productSize } : {}) };
  });
  const tax = Math.round(subtotal * 0.06);
  const shipping = 1000 + 200 * (orderItems.length - 1);
  const totals = { taxAmount: tax / 100, shippingCost: shipping / 100, totalPrice: (subtotal + tax + shipping) / 100 };
  for (const [key, value] of Object.entries(totals)) if (input[key] !== value) reject(`${key} is incorrect. Refresh your cart and try again.`);
  const order = { userId, name: input.name.trim(), shippingAddress: input.shippingAddress, orderItems,
    ...totals, status: 'pending', createdAt: now, modifiedAt: now };
  const result = await mongodb.getDb().collection('orders').insertOne(order);
  return { order: { ...order, id: result.insertedId.toString() } };
}
