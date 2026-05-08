import jwt from "jsonwebtoken";
import { IUser } from "../models/user.model";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const JWT_EXPIRES_IN = "72h";

/**
 * Sign a JWT for the given user. Single source of truth for both
 * password-based and passkey-based authentication paths.
 */
export const signJwt = (user: IUser): string => {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};
