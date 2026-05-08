import mongoose, { Schema, Document, Types } from "mongoose";

export type WebAuthnChallengeType = "registration" | "authentication";

export interface IWebAuthnChallenge extends Document {
  challenge: string; // base64url
  type: WebAuthnChallengeType;
  userId?: Types.ObjectId;
  email?: string; // for passkey-only signup before user exists
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebAuthnChallengeSchema: Schema = new Schema(
  {
    challenge: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ["registration", "authentication"],
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    email: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Mongo TTL: rows are removed automatically when expiresAt passes.
WebAuthnChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IWebAuthnChallenge>(
  "WebAuthnChallenge",
  WebAuthnChallengeSchema,
);
