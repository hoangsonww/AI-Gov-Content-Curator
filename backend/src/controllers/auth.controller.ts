import { Request, Response } from "express";
import User from "../models/user.model";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { signJwt } from "../services/auth-token.service";

/**
 * Register a new user
 *
 * @param req The request object containing user details
 * @param res The response object to send the token and user info
 */
export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(20).toString("hex");

    const user = new User({
      email,
      password: hashedPassword,
      name,
      isVerified: false,
      verificationToken,
      favorites: [],
    });

    await user.save();
    const token = signJwt(user);

    res.setHeader("Authorization", token);
    return res.status(201).json({
      user: {
        id: user._id,
        email,
        name: user.name,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (error) {
    console.error("Error in registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Login user - authenticate and generate a token
 *
 * @param req The request object containing user credentials
 * @param res The response object to send the token and user info
 */
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    if (!user.password) {
      return res.status(400).json({
        error:
          'This account uses passkey sign-in. Use "Sign in with a passkey" or reset your password to set one.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = signJwt(user);
    res.setHeader("Authorization", token);

    return res.json({
      user: {
        id: user._id,
        email,
        name: user.name,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Verify user email address - check if email is valid and token matches
 *
 * @param req The request object containing email and token
 * @param res The response object to send the verification status
 */
export const verifyEmail = async (req: Request, res: Response) => {
  const { email, token } = req.query;
  if (!email || !token)
    return res.status(400).json({ error: "Missing email or token" });

  try {
    const user = await User.findOne({ email, verificationToken: token });
    if (!user)
      return res.status(400).json({ error: "Invalid verification token" });

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    return res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Reset password request - generate a reset token
 *
 * @param req The request object containing user email
 * @param res The response object to send the reset token
 */
export const resetPasswordRequest = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    await user.save();

    return res.json({ message: "Reset password token generated", resetToken });
  } catch (error) {
    console.error("Error in reset password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Confirm reset password - update the user's password. Doubles as
 * "set initial password" for passkey-only accounts that lose all devices.
 *
 * @param req The request object containing email, token, and new password
 * @param res The response object to send the status of the password reset
 */
export const confirmResetPassword = async (req: Request, res: Response) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    const user = await User.findOne({ email, resetPasswordToken: token });
    if (!user) return res.status(400).json({ error: "Invalid token or email" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    await user.save();

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error confirming reset password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
