import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendNewsletter } from "../../../schedule/sendNewsletter";

/**
 * This API route is scheduled to run every day at 12 PM UTC.
 *
 * @param req - The request object (not used).
 * @param res - The response object to send the result.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const result = await sendNewsletter();
    return res.status(200).json({ status: "success", result });
  } catch (err: any) {
    console.error("Error in scheduled newsletter:", err);
    return res
      .status(500)
      .json({ status: "error", message: err?.message || "Unknown error" });
  }
}
