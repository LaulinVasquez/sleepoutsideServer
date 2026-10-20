import CustomError from "../errors/CustomError.mts";
import type { QueryParams } from "../models/types.mts";

export function invalidQuery(message: string): never {
  throw new CustomError({ message, statusCode: 400, code: "ERR_VALID" });
}

// Remove operator keys recursively, including objects nested in arrays.
export function sanitize<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key.startsWith("$")) delete record[key];
      else sanitize(record[key]);
    }
  }
  return value;
}

export function paginationValues(query: QueryParams) {
  const parse = (value: string | undefined, fallback: number, minimum: number, name: string) => {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) {
      invalidQuery(`${name} must be an integer greater than or equal to ${minimum}`);
    }
    return Number(value);
  };
  return { limit: parse(query.limit, 20, 1, "limit"), offset: parse(query.offset, 0, 0, "offset") };
}

export function formatFields(fields: string): Record<string, 1> {
  const names = fields.split(",").map(field => field.trim());
  if (names.some(name => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) ||
    ["__proto__", "constructor", "prototype"].includes(name))) {
    invalidQuery("fields must be a comma-separated list of field names");
  }
  return Object.fromEntries(names.map(name => [name, 1]));
}

export function buildPaginationWrapper<T>(totalCount: number, query: QueryParams) {
  const { limit, offset } = paginationValues(query);
  const link = (position: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, value);
    }
    params.set("offset", String(position));
    return `/api/v1/products/?${params}`;
  };
  return {
    count: totalCount,
    next: offset + limit < totalCount ? link(offset + limit) : null,
    previous: offset > 0 ? link(Math.max(0, offset - limit)) : null,
    results: [] as T[]
  };
}
