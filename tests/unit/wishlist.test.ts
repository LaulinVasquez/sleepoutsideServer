import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";

// Fake data layer so no database is needed
const models = vi.hoisted(() => ({
  getWishlistIds: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
  getProductById: vi.fn(),
  getProductsByIds: vi.fn(),
}));

vi.mock("../../src/models/user.model.mts", () => ({
  getWishlistIds: models.getWishlistIds,
  addToWishlist: models.addToWishlist,
  removeFromWishlist: models.removeFromWishlist,
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("../../src/models/product.model.mts", () => ({
  default: {
    getProductById: models.getProductById,
    getProductsByIds: models.getProductsByIds,
    getAllProducts: vi.fn(),
  },
}));

import { addProduct, getWishlist, removeProduct } from "../../src/services/wishlist.service.mts";
import userRoutes from "../../src/routes/user.routes.mts";
import { globalErrorHandler } from "../../src/middleware/error.middleware.mts";

const USER_ID = "64b7f0c2a1b2c3d4e5f60718";
const tent = { id: "880RR", name: "Tent" };
const bag = { id: "861PY", name: "Sleeping Bag" };

beforeEach(() => {
  vi.clearAllMocks();
  models.getWishlistIds.mockResolvedValue([]);
  models.getProductsByIds.mockResolvedValue([]);
  models.getProductById.mockResolvedValue(bag);
});

describe("wishlist service", () => {
  it("returns an empty wish list", async () => {
    expect(await getWishlist(USER_ID)).toEqual({ count: 0, results: [] });
    expect(models.getProductsByIds).not.toHaveBeenCalled();
  });

  it("returns products in the order they were added", async () => {
    models.getWishlistIds.mockResolvedValue(["861PY", "880RR"]);
    models.getProductsByIds.mockResolvedValue([tent, bag]);
    expect(await getWishlist(USER_ID)).toEqual({ count: 2, results: [bag, tent] });
  });

  it("adds a new product and reports added = true", async () => {
    const result = await addProduct(USER_ID, "861PY");
    expect(models.addToWishlist).toHaveBeenCalledWith(USER_ID, "861PY");
    expect(result.added).toBe(true);
  });

  it("does not add a duplicate", async () => {
    models.getWishlistIds.mockResolvedValue(["861PY"]);
    const result = await addProduct(USER_ID, "861PY");
    expect(models.addToWishlist).not.toHaveBeenCalled();
    expect(result.added).toBe(false);
  });

  it("rejects a product that does not exist (404)", async () => {
    models.getProductById.mockResolvedValue(null);
    await expect(addProduct(USER_ID, "NOPE1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects a missing or invalid productId (400)", async () => {
    await expect(addProduct(USER_ID, undefined)).rejects.toMatchObject({ statusCode: 400 });
    await expect(addProduct(USER_ID, { $ne: "" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 404 when the user no longer exists", async () => {
    models.getWishlistIds.mockResolvedValue(null);
    await expect(getWishlist(USER_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("removes a product that is in the list", async () => {
    models.getWishlistIds.mockResolvedValue(["861PY"]);
    await removeProduct(USER_ID, "861PY");
    expect(models.removeFromWishlist).toHaveBeenCalledWith(USER_ID, "861PY");
  });

  it("returns 404 when removing a product that is not in the list", async () => {
    await expect(removeProduct(USER_ID, "861PY")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("wishlist routes", () => {
  let server: Server;
  let baseUrl: string;
  const token = () => jwt.sign({ id: USER_ID, email: "test@example.com" }, process.env.JWT_SECRET!);

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    const app = express();
    app.use(express.json());
    app.use("/users", userRoutes);
    app.use(globalErrorHandler);
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  afterAll(() => {
    server.close();
  });

  it("requires a sign-in token (401)", async () => {
    const response = await fetch(`${baseUrl}/users/wishlist`);
    expect(response.status).toBe(401);
  });

  it("GET returns the wish list", async () => {
    const response = await fetch(`${baseUrl}/users/wishlist`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 0, results: [] });
  });

  it("POST returns 201 when added and 200 when already there", async () => {
    const post = () =>
      fetch(`${baseUrl}/users/wishlist`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ productId: "861PY" }),
      });
    expect((await post()).status).toBe(201);
    models.getWishlistIds.mockResolvedValue(["861PY"]);
    expect((await post()).status).toBe(200);
  });

  it("DELETE removes a product", async () => {
    models.getWishlistIds.mockResolvedValue(["861PY"]);
    const response = await fetch(`${baseUrl}/users/wishlist/861PY`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    expect(response.status).toBe(200);
    expect(models.removeFromWishlist).toHaveBeenCalledWith(USER_ID, "861PY");
  });
});