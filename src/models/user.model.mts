import { ObjectId } from "mongodb";
import mongodb from "../database/index.mts";
import CustomError from "../errors/CustomError.mts";

export async function getUserByEmail(email: string) {
  return mongodb.getDb().collection("users").findOne({ email });
}

export async function createUser(user: {
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  modifiedAt: Date;
}) {
  const existingUser = await getUserByEmail(user.email);

  if (existingUser) {
    throw new CustomError({
      message: "A user with that email already exists",
      statusCode: 409,
      code: "ERR_CONFLICT",
    });
  }

  try {
    const result = await mongodb.getDb().collection("users").insertOne(user);
    return { ...user, _id: result.insertedId.toString() };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      throw new CustomError({
        message: "A user with that email already exists",
        statusCode: 409,
        code: "ERR_CONFLICT",
      });
    }
    throw error;
  }
}

// Wish list: an array of product ids stored on the user document
type WishlistDoc = { wishlist?: string[]; modifiedAt?: Date };

export async function getWishlistIds(userId: string): Promise<string[] | null> {
  const user = await mongodb
    .getDb()
    .collection("users")
    .findOne({ _id: new ObjectId(userId) }, { projection: { wishlist: 1 } });

  if (!user) return null;
  return (user.wishlist as string[] | undefined) ?? [];
}

export async function addToWishlist(userId: string, productId: string) {
  return mongodb
    .getDb()
    .collection<WishlistDoc>("users")
    .updateOne(
      { _id: new ObjectId(userId) },
      { $addToSet: { wishlist: productId }, $set: { modifiedAt: new Date() } }
    );
}

export async function removeFromWishlist(userId: string, productId: string) {
  return mongodb
    .getDb()
    .collection<WishlistDoc>("users")
    .updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { wishlist: productId }, $set: { modifiedAt: new Date() } }
    );
}
