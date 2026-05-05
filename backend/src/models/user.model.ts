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
 *         isOnboarded:
 *           type: boolean
 *           description: Indicates if the user has completed the onboarding quiz
 *           default: false
 *         firstWeekInteractions:
 *           type: object
 *           description: User's first week interaction stats
 *           properties:
 *             article_views:
 *               type: number
 *               description: Number of articles viewed in the first week
 *             article_favs:
 *               type: number
 *               description: Number of articles favorited in the first week
 *             article_ratings:
 *               type: number
 *               description: Number of articles rated in the first week
 *             topic_clicks:
 *               type: number
 *               description: Number of topics clicked in the first week
 *         preferences:
 *           type: object
 *           description: User's onboarding preferences
 *           properties:
 *             topics:
 *               type: array
 *               description: Array of user's interested topics
 *               items:
 *                 type: string
 *             sources:
 *               type: array
 *               description: Array of user's preferred sources
 *               items:
 *                 type: string
 *             alertFrequency:
 *               type: string
 *               enum: [hourly, daily, weekly, monthly]
 *               description: Preferred alert frequency
 *             notifyOnNewStories:
 *               type: boolean
 *               description: Whether user wants instant notifications on new stories
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
  isOnboarded: boolean;
  createdAt: string;
  firstWeekInteractions : {
    article_views: number,
    article_favs: number,
    article_ratings: number,
    topic_clicks: number,
  }
  preferences?: {
    topics: string[];
    sources: string[];
    alertFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    notifyOnNewStories: boolean;
  };
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
    isOnboarded: { type: Boolean, default: false },
    firstWeekInteractions : {
      article_views: [{type : Number, default: 0}],
      article_favs: [{type : Number, default: 0}],
      article_ratings: [{type : Number, default: 0}],
      topic_clicks: [{type : Number, default: 0}],
    },
    preferences: {
      topics: [{ type: String }],
      sources: [{ type: String }],
      alertFrequency: { type: String, enum: ['hourly', 'daily', 'weekly', 'monthly'] },
      notifyOnNewStories: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export default mongoose.model<IUser>("User", UserSchema);
