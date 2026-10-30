import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

function authorize(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;
  const authHeader = req.headers.authorization;

  if (!secret) {
    next(new Error("JWT_SECRET is not configured"));
    return;
  }

  if (!authHeader) {
    res.status(401).json({ message: "Authorization token is required" });
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({
      message: "Authorization header must use the Bearer scheme",
    });
    return;
  }

  try {
    res.locals.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(403).json({ message: "Forbidden" });
  }
}

export default authorize;
