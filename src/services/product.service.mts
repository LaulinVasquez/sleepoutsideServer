import productModel from "../models/product.model.mts";
import type { FindProductObj, Product, QueryParams } from "../models/types.mts";
import { buildPaginationWrapper, formatFields, invalidQuery, paginationValues } from "./utils.mts";

const productFields = new Set([
  "_id", "id", "isClearance", "category", "isNew", "url", "reviews",
  "nameWithoutBrand", "name", "images", "sizesAvailable", "colors",
  "descriptionHtmlSimple", "suggestedRetailPrice", "brand", "listPrice", "finalPrice"
]);

export const getAllProducts = async (query: QueryParams = {}) => {
  for (const key of ["category", "q", "limit", "offset", "fields"] as const) {
    if (query[key] !== undefined && typeof query[key] !== "string") {
      invalidQuery(`${key} must be a single string`);
    }
  }
  const findProduct: FindProductObj = { search: {}, ...paginationValues(query) };
  if (query.q?.trim()) {
    // Treat search text literally, rather than allowing user-supplied regex patterns.
    const pattern = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    findProduct.search.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { descriptionHtmlSimple: { $regex: pattern, $options: "i" } }
    ];
  }
  if (query.category !== undefined) {
    const category = query.category;
    if (!["tents", "backpacks", "sleeping-bags", "hammocks"].includes(category)) {
      invalidQuery("category must be tents, backpacks, sleeping-bags, or hammocks");
    }
    findProduct.search.category = category as Product["category"];
  }
  if (query.fields !== undefined) {
    const fields = formatFields(query.fields);
    if (Object.keys(fields).some(field => !productFields.has(field))) {
      invalidQuery("fields contains an unknown product field");
    }
    findProduct.fieldFilters = { ...fields, _id: fields._id ?? 0 };
  }
  const { data, totalCount } = await productModel.getAllProducts(findProduct);
  return { ...buildPaginationWrapper<Partial<Product>>(totalCount, query), results: data };
};

const getProductById = async (id: string) => productModel.getProductById(id);
export default { getAllProducts, getProductById };
