import argon2 from "argon2";
import { ObjectId } from "mongodb";
import { getUserById, updatePassword } from "../models/user.model.mts";
import CustomError from "../errors/CustomError.mts";

export async function changePassword(userId: string, currentPassword: unknown, newPassword: unknown) {
  if (typeof userId !== 'string' || !ObjectId.isValid(userId)) throw new CustomError({ statusCode: 401, code: 'ERR_AUTH', message: 'Please sign in again.' });
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 100 || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
    throw new CustomError({ statusCode: 400, code: 'ERR_INPUT', message: 'Provide your current password and a new password of 6–100 characters.' });
  }
  const user = await getUserById(userId);
  if (!user || !await argon2.verify(user.password, currentPassword)) throw new CustomError({ statusCode: 401, code: 'ERR_AUTH', message: 'Current password is incorrect.' });
  const result = await updatePassword(userId, user.password, await argon2.hash(newPassword));
  if (!result.matchedCount) throw new CustomError({ statusCode: 409, code: 'ERR_CONFLICT', message: 'Password changed during this request. Please try again.' });
}
