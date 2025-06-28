import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import NewsletterSubscriber from "../models/newsletterSubscriber.model";
import Article from "../models/article.model";
import type { Resend as ResendClient } from "resend";
import { marked } from "marked";
import { cleanupArticles } from "../scripts/cleanData";

/**
 * Send a newsletter to all subscribers
 */
export async function sendNewsletter() {
  const {
    MONGODB_URI,
    RESEND_API_KEY,
    RESEND_FROM = "AI Curator <news@sonnguyenhoang.com>",
    UNSUBSCRIBE_BASE_URL,
  } = process.env;

  if (!MONGODB_URI) throw new Error("MONGODB_URI not set");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");

  const { Resend } = (await import("resend")) as typeof import("resend");
  const resend: ResendClient = new Resend(RESEND_API_KEY);

  await mongoose.connect(MONGODB_URI);

  const subscribers = await NewsletterSubscriber.find({});
  console.log(`Sending to ${subscribers.length} subscriber(s)`);

  const MAX_ARTICLES = 50; // keep payload < 400 KB
  const DATE_FMT = Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  // Rate limit: max 2 requests per second → delay 500ms between each send
  const RATE_LIMIT_DELAY_MS = 500;
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  for (const sub of subscribers) {
    const since = sub.lastSentAt ?? new Date(0);
    const articles = await Article.find({ fetchedAt: { $gt: since } })
      .sort({ fetchedAt: 1 })
      .limit(MAX_ARTICLES + 1) // +1 to detect if more were trimmed
      .lean();

    if (!articles.length) {
      console.log(`${sub.email}: up-to-date`);
      continue;
    }

    const shown = articles.slice(0, MAX_ARTICLES);
    const trimmed = articles.length > MAX_ARTICLES;

    /* ---------- build HTML body ---------- */
    const rows = shown
      .map((a, i) => {
        // Convert Markdown summary to HTML
        const summaryHtml = a.summary
          ? `<div style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#555;">${marked(a.summary)}</div>`
          : "";
        return `<tr>
          <td style="padding:16px 24px;border-bottom:1px solid #eee;">
            <a href="${a.url}" style="font-size:16px;font-weight:600;color:#0d6efd;text-decoration:none;">
              ${i + 1}. ${a.title}
            </a>
            ${summaryHtml}
            <p style="margin:6px 0 0;font-size:12px;color:#999;">
              ${DATE_FMT.format(new Date(a.fetchedAt))} · ${a.source ?? ""}
            </p>
          </td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI Article Curator Newsletter</title></head>
      <body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellspacing="0" cellpadding="0" style="padding:20px 0;">
      <tr><td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:8px;overflow:hidden;">
          <tr style="background:#0d6efd;color:#fff;"><td style="padding:24px;text-align:center;font-size:22px;font-weight:700;">
            <a href="https://sonnguyenhoang.com" style="color:#fff;text-decoration:none;">
              AI Article Curator Newsletter
            </a>
          </td></tr>
          <tr><td style="padding:20px 24px;font-size:15px;color:#333;">
            Hi there 👋 – here are the latest ${shown.length} article(s) since your last digest:
          </td></tr>
          ${rows}
          ${
            trimmed
              ? `<tr><td style="padding:16px 24px;font-size:14px;color:#555;text-align:center;">
                   …and more! Visit <a href="https://sonnguyenhoang.com" style="color:#0d6efd;text-decoration:none;">our site</a> to see all articles.
                 </td></tr>`
              : ""
          }
          <tr><td style="padding:20px 24px;text-align:center;font-size:12px;color:#999;">
            For the full list of articles, visit our website at <a href="https://synthoraai.vercel.app/" 
            style="color:#0d6efd;text-decoration:none;">synthoraai.vercel.app</a>.<br>
          </td></tr>
          <tr><td style="padding:20px 24px;text-align:center;font-size:12px;color:#999;">
            You’re receiving this because you subscribed on our site.<br>
            ${
              UNSUBSCRIBE_BASE_URL
                ? `<a href="${UNSUBSCRIBE_BASE_URL}?email=${encodeURIComponent(
                    sub.email,
                  )}" style="color:#0d6efd;text-decoration:none;">Unsubscribe</a>`
                : ""
            }
          </td></tr>
          <tr><td style="padding:20px 24px;text-align:center;font-size:12px;color:#999;">
            Visit our site: <a href="https://sonnguyenhoang.com" style="color:#0d6efd;text-decoration:none;">sonnguyenhoang.com</a>
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    /* plain-text fallback */
    const text = shown
      .map((a, i) => `${i + 1}. ${a.title}\n${a.url}`)
      .join("\n\n")
      .concat(trimmed ? "\n\n…and more on the site." : "");

    // send email and throttle to 2 requests/sec
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: sub.email,
      subject: `📰 ${shown.length} new article${
        shown.length > 1 ? "s" : ""
      } for you`,
      html,
      text,
    });

    if (error) {
      console.error(`${sub.email}: FAILED –`, error);
      // respect rate limit before next request
      await delay(RATE_LIMIT_DELAY_MS);
      continue;
    }

    console.log(`${sub.email}: sent`);
    sub.lastSentAt = new Date();
    await sub.save();

    // respect rate limit before next request
    await delay(RATE_LIMIT_DELAY_MS);
  }

  // Cleanup articles
  console.log("Cleaning up articles...");
  await cleanupArticles();
  console.log("Articles cleaned up!");

  await mongoose.disconnect();
  console.log("Finished newsletter run");
}

if (require.main === module) {
  sendNewsletter()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
