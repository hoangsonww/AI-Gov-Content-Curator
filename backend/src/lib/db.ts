import mongoose from "mongoose";

/** Fail fast instead of silently queuing queries */
mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", false);

/** Keep the connection across hot‑reloads / Lambda warm starts */
let cached: typeof mongoose | null = null;

/**
 * Connects to MongoDB with ability to reuse cached connection
 */
export async function connectDB() {
  if (cached && cached.connection.readyState === 1) return cached;

  const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mydb";

  cached = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
  });

  console.log("🟢  Connected to MongoDB:", mongoose.connection.name);
  return cached;
}
