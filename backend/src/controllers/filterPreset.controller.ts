import { Request, Response } from "express";
import FilterPreset from "../models/filterPreset.model";

/**
 * Get all filter presets for the authenticated user
 */
export const getFilterPresets = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const presets = await FilterPreset.find({ userId }).sort({ createdAt: -1 });
    res.json({ data: presets });
  } catch (error) {
    console.error("Error fetching filter presets:", error);
    res.status(500).json({ error: "Failed to fetch filter presets" });
  }
};

/**
 * Get a single filter preset by ID
 */
export const getFilterPresetById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const preset = await FilterPreset.findOne({ _id: id, userId });

    if (!preset) {
      return res.status(404).json({ error: "Filter preset not found" });
    }

    res.json(preset);
  } catch (error) {
    console.error("Error fetching filter preset:", error);
    res.status(500).json({ error: "Failed to fetch filter preset" });
  }
};

/**
 * Create a new filter preset
 */
export const createFilterPreset = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { name, filters } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!name || !filters) {
      return res.status(400).json({ error: "Name and filters are required" });
    }

    // Check if a preset with the same name already exists for this user
    const existingPreset = await FilterPreset.findOne({ userId, name });
    if (existingPreset) {
      return res.status(409).json({
        error: "A preset with this name already exists",
      });
    }

    const preset = new FilterPreset({
      userId,
      name,
      filters,
    });

    await preset.save();
    res.status(201).json(preset);
  } catch (error) {
    console.error("Error creating filter preset:", error);
    res.status(500).json({ error: "Failed to create filter preset" });
  }
};

/**
 * Update an existing filter preset
 */
export const updateFilterPreset = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { name, filters } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Find the preset and ensure it belongs to the user
    const preset = await FilterPreset.findOne({ _id: id, userId });

    if (!preset) {
      return res.status(404).json({ error: "Filter preset not found" });
    }

    // If name is being updated, check for duplicates
    if (name && name !== preset.name) {
      const existingPreset = await FilterPreset.findOne({ userId, name });
      if (existingPreset) {
        return res.status(409).json({
          error: "A preset with this name already exists",
        });
      }
      preset.name = name;
    }

    if (filters) {
      preset.filters = filters;
    }

    await preset.save();
    res.json(preset);
  } catch (error) {
    console.error("Error updating filter preset:", error);
    res.status(500).json({ error: "Failed to update filter preset" });
  }
};

/**
 * Delete a filter preset
 */
export const deleteFilterPreset = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const preset = await FilterPreset.findOneAndDelete({ _id: id, userId });

    if (!preset) {
      return res.status(404).json({ error: "Filter preset not found" });
    }

    res.json({ message: "Filter preset deleted successfully" });
  } catch (error) {
    console.error("Error deleting filter preset:", error);
    res.status(500).json({ error: "Failed to delete filter preset" });
  }
};
