import mongoose, { Schema, Document } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address, unique identifier
 *         password:
 *           type: string
 *           description: Hashed user password
 *         name:
 *           type: string
 *           description: User's full name (optional)
 *         isVerified:
 *           type: boolean
 *           description: Indicates if the user's email has been verified
 *           default: false
 *         verificationToken:
 *           type: string
 *           description: Token used for email verification
 *         resetPasswordToken:
 *           type: string
 *           description: Token used to reset user's password (temporary)
 *         favorites:
 *           type: array
 *           description: Array of favorited article IDs
 *           items:
 *             type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the user was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the user was last updated
 */

export interface IUser extends Document {
  email: string;
  password: string;
  name?: string;
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  favorites: string[]; // Array of Article IDs
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true },
    password: { type: String, required: true },
    name: { type: String },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    favorites: [{ type: String }],
  },
  { timestamps: true },
);

export default mongoose.model<IUser>("User", UserSchema);
