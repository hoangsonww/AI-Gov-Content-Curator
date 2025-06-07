import { Router } from "express";
import {
  getCommentsByArticle,
  getAllComments,
  getCommentsByUser,
  addComment,
  updateComment,
  deleteComment,
  voteComment,
} from "../controllers/comment.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Comments
 *     description: API endpoints for managing comments
 */

/**
 * @swagger
 * /api/comments/article/{articleId}:
 *   get:
 *     tags: [Comments]
 *     summary: Retrieve comments for a specific article
 *     description: |
 *       Fetches all comments belonging to the article with the given ID.
 *       Results are sorted by creation date, newest first.
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         description: MongoDB ObjectId of the article
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number (default 1)
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Number of comments per page (default 10)
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: An array of comment objects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid `articleId` or query params
 *       500:
 *         description: Server error
 */
router.get("/article/:articleId", getCommentsByArticle);

/**
 * @swagger
 * /api/comments:
 *   get:
 *     tags: [Comments]
 *     summary: Retrieve all comments
 *     description: Returns every comment in the system, including article title and author details.
 *     responses:
 *       200:
 *         description: An array of all comments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Server error
 */
router.get("/", getAllComments);

/**
 * @swagger
 * /api/comments/user/{userId}:
 *   get:
 *     tags: [Comments]
 *     summary: Retrieve comments by a specific user
 *     description: |
 *       Fetches all comments authored by the specified user, sorted by newest first.
 *       Only that user (or an admin) may retrieve this list.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: MongoDB ObjectId of the user
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of comment objects by user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid `userId`
 *       403:
 *         description: Forbidden (accessing another user’s comments)
 *       500:
 *         description: Server error
 */
router.get("/user/:userId", getCommentsByUser);

/**
 * @swagger
 * /api/comments/article/{articleId}:
 *   post:
 *     tags: [Comments]
 *     summary: Add a new comment to an article
 *     security:
 *       - ApiKeyAuth: []
 *     description: |
 *       Creates a new comment under the specified article.
 *       The authenticated user is automatically set as the author.
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         description: MongoDB ObjectId of the article
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Comment payload
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The body text of the comment
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 article:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     title: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     username: { type: string }
 *                     name: { type: string }
 *                 content: { type: string }
 *                 createdAt: { type: string, format: date-time }
 *                 updatedAt: { type: string, format: date-time }
 *       400:
 *         description: Missing or invalid `content` / `articleId`
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
router.post("/article/:articleId", authenticate, addComment);

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     tags: [Comments]
 *     summary: Update an existing comment
 *     security:
 *       - ApiKeyAuth: []
 *     description: |
 *       Edits the `content` of the comment with the given ID.
 *       Only the original author may perform this operation.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the comment
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Updated comment text
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The updated comment body
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Invalid `id` or missing `content`
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (not the comment’s author)
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.put("/:id", authenticate, updateComment);

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     tags: [Comments]
 *     summary: Delete a comment
 *     security:
 *       - ApiKeyAuth: []
 *     description: |
 *       Permanently removes the comment with the given ID.
 *       Only the original author may delete their comment.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the comment
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Comment deleted successfully (no content)
 *       400:
 *         description: Invalid `id`
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (not the comment’s author)
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", authenticate, deleteComment);

/**
 * @swagger
 * /api/comments/{id}/vote:
 *   post:
 *     tags: [Comments]
 *     summary: Up-vote / down-vote / clear vote on a comment
 *     security:
 *       - ApiKeyAuth: []
 *     description: |
 *       Records or clears a vote by the authenticated user on the specified comment.
 *       A user may cast **one** vote per comment:
 *       * `1`  → up-vote
 *       * `-1` → down-vote
 *       * `0`  → remove their vote
 *       Returns the updated comment with all its fields.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the comment
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 type: integer
 *                 enum: [-1, 0, 1]
 *                 description: Vote value
 *     responses:
 *       200:
 *         description: Updated comment object (with recalculated score)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 article:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     title:
 *                       type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     name:
 *                       type: string
 *                 content:
 *                   type: string
 *                 upvotes:
 *                   type: array
 *                   items:
 *                     type: string
 *                 downvotes:
 *                   type: array
 *                   items:
 *                     type: string
 *                 score:
 *                   type: integer
 *                   description: upvotes.length − downvotes.length
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid `id` or `value`
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.post("/:id/vote", authenticate, voteComment);

export default router;
