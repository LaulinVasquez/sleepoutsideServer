import mongodb from "../database/index.mts";
import type {FindProductObj, Product} from "./types.mts";


async function getAllProducts({ search, limit, offset, fieldFilters }: FindProductObj) {
    const productsCollection = mongodb.getDb().collection<Product>("products");
    const totalCount = await productsCollection.countDocuments(search);
    const cursor = productsCollection.find(search).sort({ _id: 1 }).skip(offset).limit(limit);
    if (fieldFilters) cursor.project(fieldFilters);
    const data = await cursor.toArray();
    return { data, totalCount };
}

async function getProductById(id: string): Promise<Product | null> {
    const product = await mongodb.getDb().collection<Product>("products").findOne({id: id});
    return product;
}

async function getProductsByIds(ids: string[]): Promise<Product[]> {
    return mongodb.getDb().collection<Product>("products").find({ id: { $in: ids } }).toArray();
}

export default {
    getAllProducts,
    getProductById,
    getProductsByIds
};


