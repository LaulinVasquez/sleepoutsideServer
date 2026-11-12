import { ObjectId } from "mongodb";
import productModel from "../models/product.model.mts";
import { addToWishlist, getWishlistIds, removeFromWishlist } from "../models/user.model.mts";
import CustomError from "../errors/CustomError.mts";
import type { Product } from "../models/types.mts";

// The user id comes from the JWT that authorize() verified
function checkUserId(userId: unknown): string {
  if (typeof userId !== "string" || !ObjectId.isValid(userId)) {
    throw new CustomError({ statusCode: 401, code: "ERR_AUTH", message: "Please sign in to continue." });
  }
  return userId;
}

// Product ids look like "861PY"
function checkProductId(productId: unknown): string {
  if (typeof productId !== "string" || !/^[A-Za-z0-9]{1,20}$/.test(productId.trim())) {
    throw new CustomError({ statusCode: 400, code: "ERR_VALID", message: "productId must be a valid product id" });
  }
  return productId.trim();
}

async function loadIds(userId: string): Promise<string[]> {
  const ids = await getWishlistIds(userId);
  if (ids === null) {
    throw new CustomError({ statusCode: 404, code: "ERR_NF", message: "User not found" });
  }
  return ids;
}

// GET: full product details, in the order they were added
export async function getWishlist(userId: unknown) {
  const ids = await loadIds(checkUserId(userId));
  const products = ids.length > 0 ? await productModel.getProductsByIds(ids) : [];
  const byId = new Map(products.map((product) => [product.id, product]));
  const results = ids
    .map((id) => byId.get(id))
    .filter((product): product is Product => product !== undefined);

  return { count: results.length, results };
}

// POST: add a product (no duplicates). "added" is false if it was already there.
export async function addProduct(userId: unknown, productId: unknown) {
  const uid = checkUserId(userId);
  const pid = checkProductId(productId);
  const ids = await loadIds(uid);

  const product = await productModel.getProductById(pid);
  if (!product) {
    throw new CustomError({ statusCode: 404, code: "ERR_NF", message: `Product ${pid} Not Found` });
  }

  const added = !ids.includes(pid);
  if (added) await addToWishlist(uid, pid);

  return { added, wishlist: await getWishlist(uid) };
}

// DELETE: remove a product
export async function removeProduct(userId: unknown, productId: unknown) {
  const uid = checkUserId(userId);
  const pid = checkProductId(productId);
  const ids = await loadIds(uid);

  if (!ids.includes(pid)) {
    throw new CustomError({ statusCode: 404, code: "ERR_NF", message: `Product ${pid} is not in your wish list` });
  }

  await removeFromWishlist(uid, pid);
  return getWishlist(uid);
}