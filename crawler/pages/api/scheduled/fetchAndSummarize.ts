import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchAndSummarize } from "../../../schedule/fetchAndSummarize";

/**
 * This API route is scheduled to run every day at 9 AM UTC.
 *
 * @param req - The request object (not used).
 * @param res - The response object to send the result.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const result = await fetchAndSummarize();
    return res.status(200).json({ status: "success", result });
  } catch (err: any) {
    console.error("Error in scheduled function:", err);
    return res
      .status(500)
      .json({ status: "error", message: err?.message || "Unknown error" });
  }
}
