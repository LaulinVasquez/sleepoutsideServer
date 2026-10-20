import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => {
  const cursor = { sort: vi.fn(), skip: vi.fn(), limit: vi.fn(), project: vi.fn(), toArray: vi.fn() };
  for (const name of ["sort", "skip", "limit", "project"]) cursor[name].mockReturnValue(cursor);
  return { cursor, collection: { countDocuments: vi.fn(), find: vi.fn(() => cursor) } };
});
vi.mock("../../src/database/index.mts", () => ({
  default: { getDb: () => ({ collection: () => db.collection }) }
}));
import service from "../../src/services/product.service.mts";
import router from "../../src/routes/product.routes.mts";
import { sanitize, buildPaginationWrapper, formatFields } from "../../src/services/utils.mts";

beforeEach(() => {
  vi.clearAllMocks();
  db.collection.countDocuments.mockResolvedValue(35);
  db.cursor.toArray.mockResolvedValue([{ name: "Tent", finalPrice: 99 }]);
});

describe("product queries", () => {
  it("uses defaults and returns total count and pagination", async () => {
    const result = await service.getAllProducts();
    expect(db.collection.find).toHaveBeenCalledWith({});
    expect(db.cursor.skip).toHaveBeenCalledWith(0);
    expect(db.cursor.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual({ count: 35, previous: null, next: "/api/v1/products/?offset=20", results: [{ name: "Tent", finalPrice: 99 }] });
  });
  it("combines category with literal case-insensitive search of either text field", async () => {
    await service.getAllProducts({ category: "tents", q: "a.*[b]" });
    const filter = db.collection.find.mock.calls[0][0];
    expect(filter.category).toBe("tents");
    expect(filter.$or).toHaveLength(2);
    for (const [i, field] of ["name", "descriptionHtmlSimple"].entries()) {
      const condition = filter.$or[i][field];
      const regex = new RegExp(condition.$regex, condition.$options);
      expect(regex.test("A.*[B]")).toBe(true);
      expect(regex.test("anything b")).toBe(false);
    }
    expect(db.collection.countDocuments).toHaveBeenCalledWith(filter);
  });
  it("applies pagination and excludes implicit _id from selected fields", async () => {
    const result = await service.getAllProducts({ fields: " name,finalPrice ", limit: "5", offset: "3", category: "tents" });
    expect(db.cursor.project).toHaveBeenCalledWith({ name: 1, finalPrice: 1, _id: 0 });
    expect(db.cursor.skip).toHaveBeenCalledWith(3);
    expect(db.cursor.limit).toHaveBeenCalledWith(5);
    expect(new URL(result.previous, "http://test").searchParams.get("offset")).toBe("0");
    expect(new URL(result.next, "http://test").searchParams.get("category")).toBe("tents");
  });
  it.each([
    { limit: "0" }, { limit: "-1" }, { limit: "2.5" }, { limit: "20oops" },
    { limit: "9007199254740992" }, { offset: "-1" }, { offset: "" },
    { q: ["a", "b"] }, { category: { $ne: "" } }, { category: "shoes" },
    { fields: "$where" }, { fields: "name,,id" }, { fields: "password" }, { fields: "__proto__" }
  ])("rejects invalid query %j before database access", async query => {
    await expect(service.getAllProducts(query)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.collection.find).not.toHaveBeenCalled();
  });
  it("returns no next link at the end, including unaligned offsets", () => {
    expect(buildPaginationWrapper(35, { limit: "20", offset: "15" }).next).toBeNull();
    expect(buildPaginationWrapper(0, {}).previous).toBeNull();
  });
  it("keeps explicitly requested _id", async () => {
    await service.getAllProducts({ fields: "_id,name" });
    expect(db.cursor.project).toHaveBeenCalledWith({ _id: 1, name: 1 });
  });
});

describe("sanitization and route responses", () => {
  it("removes operator keys at every depth and handles null and arrays", () => {
    const value = { $where: "bad", nested: [{ $gt: 1, safe: "price $5" }, null] };
    expect(sanitize(value)).toEqual({ nested: [{ safe: "price $5" }, null] });
    expect(formatFields("name, finalPrice")).toEqual({ name: 1, finalPrice: 1 });
  });
  const handler = router.stack.find(layer => layer.route?.path === "/").route.stack[0].handle;
  it("sends the paginated response", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await handler({ query: { limit: "5", $where: "bad" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].count).toBe(35);
    expect(next).not.toHaveBeenCalled();
  });
  it("forwards a 404 when no products match", async () => {
    db.collection.countDocuments.mockResolvedValue(0);
    db.cursor.toArray.mockResolvedValue([]);
    const next = vi.fn();
    await handler({ query: {} }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
  it("forwards validation errors", async () => {
    const next = vi.fn();
    await handler({ query: { limit: "invalid" } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
