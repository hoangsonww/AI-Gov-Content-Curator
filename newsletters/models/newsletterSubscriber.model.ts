import mongoose, { Schema, Document } from "mongoose";

export interface INewsletterSubscriber extends Document {
  email: string;
  subscribedAt: Date;
  lastSentAt: Date | null;
}

const NewsletterSubscriberSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    subscribedAt: {
      type: Date,
      default: () => new Date(),
    },
    /** Date of the last newsletter that *this* user received */
    lastSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model<INewsletterSubscriber>(
  "NewsletterSubscriber",
  NewsletterSubscriberSchema,
);
