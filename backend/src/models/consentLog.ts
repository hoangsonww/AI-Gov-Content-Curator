import mongoose from "mongoose";

const ConsentLogSchema = new mongoose.Schema(
  {
    consent: {
      type: String,
      enum: ["accepted", "rejected"],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

export default mongoose.model("ConsentLog", ConsentLogSchema);