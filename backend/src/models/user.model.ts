import mongoose, { Schema, Document } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
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
 *           description: Hashed user password (optional — accounts may be passkey-only)
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
 *         hasPasskeys:
 *           type: boolean
 *           description: Denormalized flag indicating the user has at least one registered passkey
 *           default: false
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
  password?: string;
  name?: string;
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  hasPasskeys?: boolean;
  favorites: string[]; // Array of Article IDs
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true },
    password: { type: String, required: false },
    name: { type: String },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    hasPasskeys: { type: Boolean, default: false },
    favorites: [{ type: String }],
  },
  { timestamps: true },
);

// Belt-and-suspenders: a user must always have at least one credential —
// a password or a passkey. Prevents accidental orphan accounts.
UserSchema.pre("save", function (next) {
  const doc = this as unknown as IUser;
  if (!doc.password && !doc.hasPasskeys) {
    return next(
      new Error(
        "User must have at least one credential (password or passkey).",
      ),
    );
  }
  next();
});

export default mongoose.model<IUser>("User", UserSchema);
