import { Request, Response } from "express";
import validator from "validator";
import NewsletterSubscriber from "../models/newsletterSubscriber.model";

/** -----------------------------------------------------------------
 *  Ensure the test account exists exactly once in the DB
 *  (runs once when this module is first evaluated).
 *  ----------------------------------------------------------------*/
// (async () => {
//   const testEmail = "snguyen2022@macduffie.org";
//   const existing = await NewsletterSubscriber.findOne({ email: testEmail });
//   if (!existing) {
//     await NewsletterSubscriber.create({ email: testEmail });
//     console.log(`Seeded test subscriber ${testEmail}`);
//   }
// })().catch((err) =>
//   console.error("Failed to seed test subscriber:", err.message),
// );

/**
 * Subscribe a user to the newsletter
 *
 * @param req The request object containing the email address in the body
 * @param res The response object to send the subscription status
 */
export const subscribe = async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email || !validator.isEmail(email)) {
    return res
      .status(400)
      .json({ error: "A valid e‑mail address is required" });
  }

  const normalized = email.toLowerCase();

  try {
    const existing = await NewsletterSubscriber.findOne({ email: normalized });
    if (existing) {
      return res.status(200).json({ message: "You’re already subscribed." });
    }

    await NewsletterSubscriber.create({ email: normalized });
    return res.status(201).json({ message: "Subscription successful! 🎉" });
  } catch (err) {
    console.error("Failed to create subscription", err);
    return res.status(500).json({ error: "Server error—try again later." });
  }
};

/**
 * Unsubscribe a user from the newsletter
 *
 * @param req The request object containing the email address in the body or query
 * @param res The response object to send the unsubscription status
 */
export const unsubscribe = async (req: Request, res: Response) => {
  const email =
    (req.method === "POST"
      ? (req.body as { email?: string }).email
      : undefined) ?? (req.query.email as string | undefined);

  if (!email || !validator.isEmail(email)) {
    return res
      .status(400)
      .json({ error: "A valid e‑mail address is required to unsubscribe." });
  }

  const normalized = email.toLowerCase();

  try {
    const deleted = await NewsletterSubscriber.findOneAndDelete({
      email: normalized,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ message: "E‑mail address was not subscribed." });
    }

    return res
      .status(200)
      .json({ message: "You have been unsubscribed successfully." });
  } catch (err) {
    console.error("Failed to unsubscribe:", err);
    return res.status(500).json({ error: "Server error—try again later." });
  }
};
