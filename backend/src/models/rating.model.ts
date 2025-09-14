import { Schema, model, Document, Types } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     Rating:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier of the rating.
 *         articleId:
 *           type: string
 *           description: ID of the rated article.
 *         userId:
 *           type: string
 *           description: ID of the user who rated (optional for anonymous ratings).
 *         value:
 *           type: number
 *           description: Rating value (-100 to 100 for meter, 1-5 for stars).
 *         ratingType:
 *           type: string
 *           enum: [meter, stars]
 *           description: Type of rating system used.
 *         sessionId:
 *           type: string
 *           description: Session ID for anonymous users.
 *         comment:
 *           type: string
 *           description: Optional comment with the rating.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the rating was created.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the rating was last updated.
 *     RatingStats:
 *       type: object
 *       properties:
 *         articleId:
 *           type: string
 *           description: ID of the article.
 *         averageRating:
 *           type: number
 *           description: Average rating value.
 *         totalRatings:
 *           type: number
 *           description: Total number of ratings.
 *         distribution:
 *           type: object
 *           description: Distribution of ratings by value.
 */

export interface IRating extends Document {
  articleId: Types.ObjectId;
  userId?: Types.ObjectId;
  value: number;
  ratingType: "meter" | "stars";
  sessionId?: string;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ratingSchema = new Schema<IRating>(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
      validate: {
        validator: function (this: IRating, v: number) {
          if (this.ratingType === "meter") {
            return v >= -100 && v <= 100;
          } else if (this.ratingType === "stars") {
            return v >= 1 && v <= 5;
          }
          return false;
        },
        message: (props: any) => {
          if (props.instance.ratingType === "meter") {
            return "Meter rating value must be between -100 and 100";
          }
          return "Star rating value must be between 1 and 5";
        },
      },
    },
    ratingType: {
      type: String,
      enum: ["meter", "stars"],
      default: "meter",
      required: true,
    },
    sessionId: {
      type: String,
      sparse: true,
      index: true,
    },
    comment: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one rating per user/session per article
ratingSchema.index(
  { articleId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true } }
  }
);

ratingSchema.index(
  { articleId: 1, sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $exists: true } }
  }
);

// Custom toJSON transform
ratingSchema.set("toJSON", {
  transform: function (doc, ret) {
    return {
      _id: ret._id,
      articleId: ret.articleId,
      userId: ret.userId,
      value: ret.value,
      ratingType: ret.ratingType,
      sessionId: ret.sessionId,
      comment: ret.comment,
      createdAt: ret.createdAt,
      updatedAt: ret.updatedAt,
    };
  },
});

const Rating = model<IRating>("Rating", ratingSchema);
export default Rating;