import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

/**
 * Middleware to authenticate requests via JWT token.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * Like `authenticate`, but never rejects the request. If a valid token is
 * present, sets `req.user`; otherwise leaves it unset and continues. Used by
 * routes that should work for both logged-in and anonymous callers (e.g.
 * feature-flag evaluation), where identity only affects *which* result is
 * returned, not whether the request is allowed at all.
 */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
  } catch (err) {
    // Invalid/expired token on an optional route — proceed unauthenticated
    // rather than rejecting the request.
  }
  next();
};
