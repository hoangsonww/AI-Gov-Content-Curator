import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     Passkey:
 *       type: object
 *       required:
 *         - userId
 *         - credentialId
 *         - publicKey
 *         - counter
 *         - nickname
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *           description: Owning User _id
 *         credentialId:
 *           type: string
 *           description: Base64URL-encoded credential identifier (unique)
 *         counter:
 *           type: integer
 *           description: Authenticator signature counter
 *         transports:
 *           type: array
 *           items:
 *             type: string
 *         deviceType:
 *           type: string
 *           enum: [singleDevice, multiDevice]
 *         backedUp:
 *           type: boolean
 *         nickname:
 *           type: string
 *         aaguid:
 *           type: string
 *         lastUsedAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export type PasskeyTransport =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";

export interface IPasskey extends Document {
  userId: Types.ObjectId;
  credentialId: string; // base64url
  publicKey: Buffer;
  counter: number;
  transports?: PasskeyTransport[];
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  nickname: string;
  aaguid?: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PasskeySchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    credentialId: { type: String, required: true, unique: true, index: true },
    publicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true, default: 0 },
    transports: [{ type: String }],
    deviceType: {
      type: String,
      enum: ["singleDevice", "multiDevice"],
      default: "singleDevice",
    },
    backedUp: { type: Boolean, default: false },
    nickname: { type: String, required: true, default: "Passkey" },
    aaguid: { type: String },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.model<IPasskey>("Passkey", PasskeySchema);
