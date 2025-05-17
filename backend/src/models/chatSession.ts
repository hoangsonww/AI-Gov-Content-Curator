import mongoose, { Document, Schema } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       description: >-
 *         A single chat message in a session.
 *         The `role` field indicates who sent it (system, user, or assistant),
 *         `content` holds the text body, and `timestamp` records when it was created.
 *       required:
 *         - role
 *         - content
 *       properties:
 *         role:
 *           type: string
 *           enum:
 *             - system
 *             - user
 *             - assistant
 *           description: The origin of the message.
 *         content:
 *           type: string
 *           description: The text content of the message.
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: ISO-8601 timestamp for when the message was created.
 *
 *     ChatSession:
 *       type: object
 *       description: >-
 *         A conversation thread tied to a specific article.
 *         Each session holds an array of `Message` entries in chronological order.
 *       required:
 *         - articleId
 *       properties:
 *         _id:
 *           type: string
 *           readOnly: true
 *           description: MongoDB‐generated unique identifier for the session.
 *         articleId:
 *           type: string
 *           description: Identifier of the associated article (must be unique).
 *         messages:
 *           type: array
 *           description: Ordered list of all messages exchanged in this session.
 *           items:
 *             $ref: '#/components/schemas/Message'
 */

interface IMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface IChatSession extends Document {
  articleId: string;
  messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: () => new Date() },
});

const ChatSessionSchema = new Schema<IChatSession>({
  articleId: { type: String, required: true, unique: true },
  messages: { type: [MessageSchema], default: [] },
});

export default mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);
