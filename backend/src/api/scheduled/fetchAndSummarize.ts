import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchAndSummarize } from "../../schedule/fetchAndSummarize";

/**
 * @swagger
 * /api/scheduled/fetchAndSummarize:
 *   get:
 *     tags: [Scheduled]
 *     summary: Fetch and summarize articles
 *     responses:
 *       200:
 *         description: Articles fetched and summarized successfully.
 *       500:
 *         description: Server error.
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
