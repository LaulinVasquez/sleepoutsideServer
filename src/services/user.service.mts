import argon2 from "argon2";
import { createUser, getUserByEmail } from "../models/user.model.mts";
import type { User } from "../models/types.mts";
import { generateToken, validator } from "./utils.mts";
import { UserSchema } from "../database/json-schema.mts";

export async function register(email: string, password: string, name: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();
  const hashedPassword = await argon2.hash(password);
  const now = new Date();
  const newUser = {
    email: normalizedEmail,
    password: hashedPassword,
    name: normalizedName,
    createdAt: now,
    modifiedAt: now,
  };

  validator(UserSchema, newUser);
  return createUser(newUser);
}

export async function login(email: string, password: string) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = (await getUserByEmail(email)) as User | null;
  if (!user || !user.password || !user._id) {
    return null;
  }
  

  const passwordMatches = await argon2.verify(user.password, password);

  if (!passwordMatches) {
    return null;
  }

  const token = generateToken({
    id: user._id.toString(),
    email: user.email,
  });

  return {
    token,
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
    },
  };
}