import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exec } from "child_process";
import { promisify } from "util";

const run = promisify(exec);

/**
 * This API route is scheduled to run every day at 6 AM UTC.
 *
 * @param _ - The request object (not used).
 * @param res - The response object to send the result.
 */
export default async function handler(_: VercelRequest, res: VercelResponse) {
  try {
    const { stdout, stderr } = await run(
      "npx ts-node --transpile-only scripts/cleanArticles.ts",
      { cwd: process.cwd() },
    );

    return res.status(200).json({
      status: "success",
      stdout,
      stderr,
    });
  } catch (err: any) {
    console.error("cleanArticles failed:", err);
    return res
      .status(500)
      .json({ status: "error", message: err?.message || "Unknown error" });
  }
}
