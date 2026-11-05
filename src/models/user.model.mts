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
