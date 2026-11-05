import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import CustomError from "../errors/CustomError.mts";

function authorize(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;
  const authHeader = req.headers.authorization;

  if (!secret) {
    next(new Error("JWT_SECRET is not configured"));
    return;
  }

  if (!authHeader) {
    next(new CustomError({ statusCode: 401, code: "ERR_AUTH", message: "Please sign in to continue." }));
    return;
  }

  const [scheme, token, extra] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token || extra !== undefined) {
    next(new CustomError({ statusCode: 401, code: "ERR_AUTH", message: "Please sign in to continue." }));
    return;
  }

  try {
    res.locals.user = jwt.verify(token, secret);
    next();
  } catch {
    next(new CustomError({ statusCode: 401, code: "ERR_AUTH", message: "Your session is invalid or has expired. Please sign in again." }));
  }
}

export default authorize;
