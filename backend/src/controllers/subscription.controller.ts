import { Request, Response } from "express";
import Subscription from "../models/subscription.model";

/**
 * Get all subscriptions for the authenticated user
 */
export const getUserSubscriptions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const subscriptions = await Subscription.find({ userId });
    res.status(200).json(subscriptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a new subscription for the authenticated user
 */
export const createSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { topics, keywords, sources, mode, emailEnabled, pushEnabled } = req.body;

    // Validate mode
    if (mode && !['realtime', 'daily'].includes(mode)) {
      return res.status(400).json({ error: "Mode must be either 'realtime' or 'daily'" });
    }

    const subscription = new Subscription({
      userId,
      topics: topics || [],
      keywords: keywords || [],
      sources: sources || [],
      mode: mode || 'realtime',
      emailEnabled: emailEnabled !== undefined ? emailEnabled : true,
      pushEnabled: pushEnabled !== undefined ? pushEnabled : false,
    });

    const savedSubscription = await subscription.save();
    res.status(201).json(savedSubscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update a subscription by ID (only if it belongs to the authenticated user)
 */
export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { topics, keywords, sources, mode, emailEnabled, pushEnabled } = req.body;

    // Validate mode if provided
    if (mode && !['realtime', 'daily'].includes(mode)) {
      return res.status(400).json({ error: "Mode must be either 'realtime' or 'daily'" });
    }

    const updateData: any = {};
    if (topics !== undefined) updateData.topics = topics;
    if (keywords !== undefined) updateData.keywords = keywords;
    if (sources !== undefined) updateData.sources = sources;
    if (mode !== undefined) updateData.mode = mode;
    if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled;
    if (pushEnabled !== undefined) updateData.pushEnabled = pushEnabled;

    const subscription = await Subscription.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.status(200).json(subscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a subscription by ID (only if it belongs to the authenticated user)
 */
export const deleteSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const subscription = await Subscription.findOneAndDelete({ _id: id, userId });

    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get a specific subscription by ID (only if it belongs to the authenticated user)
 */
export const getSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const subscription = await Subscription.findOne({ _id: id, userId });

    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.status(200).json(subscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};