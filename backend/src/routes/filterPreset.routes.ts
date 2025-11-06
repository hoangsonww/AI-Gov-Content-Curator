import { Router } from "express";
import {
  getFilterPresets,
  getFilterPresetById,
  createFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
} from "../controllers/filterPreset.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Filter Presets
 *     description: API endpoints for managing saved filter presets
 */

/**
 * @swagger
 * /api/filters:
 *   get:
 *     tags: [Filter Presets]
 *     summary: Get all filter presets for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of filter presets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FilterPreset'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch filter presets
 */
router.get("/", authenticate, getFilterPresets);

/**
 * @swagger
 * /api/filters/{id}:
 *   get:
 *     tags: [Filter Presets]
 *     summary: Get a single filter preset by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The filter preset ID
 *     responses:
 *       200:
 *         description: Filter preset details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FilterPreset'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Filter preset not found
 *       500:
 *         description: Failed to fetch filter preset
 */
router.get("/:id", authenticate, getFilterPresetById);

/**
 * @swagger
 * /api/filters:
 *   post:
 *     tags: [Filter Presets]
 *     summary: Create a new filter preset
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - filters
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name for the preset
 *               filters:
 *                 type: object
 *                 description: Filter criteria
 *                 properties:
 *                   source:
 *                     type: string
 *                   topic:
 *                     type: string
 *                   dateRange:
 *                     type: object
 *                     properties:
 *                       from:
 *                         type: string
 *                         format: date-time
 *                       to:
 *                         type: string
 *                         format: date-time
 *     responses:
 *       201:
 *         description: Filter preset created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FilterPreset'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Preset with this name already exists
 *       500:
 *         description: Failed to create filter preset
 */
router.post("/", authenticate, createFilterPreset);

/**
 * @swagger
 * /api/filters/{id}:
 *   put:
 *     tags: [Filter Presets]
 *     summary: Update an existing filter preset
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The filter preset ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New name for the preset
 *               filters:
 *                 type: object
 *                 description: Updated filter criteria
 *                 properties:
 *                   source:
 *                     type: string
 *                   topic:
 *                     type: string
 *                   dateRange:
 *                     type: object
 *                     properties:
 *                       from:
 *                         type: string
 *                         format: date-time
 *                       to:
 *                         type: string
 *                         format: date-time
 *     responses:
 *       200:
 *         description: Filter preset updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FilterPreset'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Filter preset not found
 *       409:
 *         description: Preset with this name already exists
 *       500:
 *         description: Failed to update filter preset
 */
router.put("/:id", authenticate, updateFilterPreset);

/**
 * @swagger
 * /api/filters/{id}:
 *   delete:
 *     tags: [Filter Presets]
 *     summary: Delete a filter preset
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The filter preset ID
 *     responses:
 *       200:
 *         description: Filter preset deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Filter preset not found
 *       500:
 *         description: Failed to delete filter preset
 */
router.delete("/:id", authenticate, deleteFilterPreset);

export default router;
