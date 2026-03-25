import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import favicon from "serve-favicon";
import dotenv from "dotenv";
import mongoose from "mongoose";

import articleRoutes from "./routes/article.routes";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import newsletterRoutes from "./routes/newsletter.routes";
import chatRoutes from "./routes/chat.routes";
import commentRoutes from "./routes/comment.routes";
import ratingRoutes from "./routes/rating.routes";
import biasRoutes from "./routes/bias.routes";
import orchestratorRoutes from "./routes/orchestrated-chat.routes";

import swaggerDocs from "./swagger/swagger";

dotenv.config();

const app = express();

/* ───────────── MongoDB connection ───────────── */

// Tell Mongoose to fail fast instead of silently queuing queries
// mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", false);

// Cache the connection across hot‑reloads or server‑less warm starts
let cachedConn: typeof mongoose | null = null;

/**
 * Connect to MongoDB and cache the connection.
 */
async function connectDB() {
  if (cachedConn && cachedConn.connection.readyState === 1) return cachedConn;

  const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mydb";

  try {
    cachedConn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log("🟢 Connected to MongoDB");
    return cachedConn;
  } catch (err) {
    console.error("🔴 MongoDB connection error:", err);
    throw err;
  }
}

// Start the connection immediately; crash the process if it fails
connectDB().catch(() => process.exit(1));

/* ───────────── Global middleware ───────────── */

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

/* ───────────── Swagger UI ───────────── */

app.get("/swagger.json", (_req: Request, res: Response) => {
  res.json(swaggerDocs);
});

app.get("/api-docs", (_req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>SynthoraAI - AI Article Curator API Docs</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
        <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@4.15.5/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@4.15.5/favicon-16x16.png" sizes="16x16" />
        <style>body{margin:0;padding:0}</style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = () => {
            SwaggerUIBundle({
              url: '/swagger.json',
              dom_id: '#swagger-ui',
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              layout: "StandaloneLayout"
            });
          }
        </script>
      </body>
    </html>
  `);
});

// Redirect root "/" to "/api-docs"
app.get("/", (_req: Request, res: Response) => res.redirect("/api-docs"));

/* ───────────── Logging ───────────── */

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* ───────────── Optional safeguard ─────────────
   Reject requests until the DB is connected.
----------------------------------------------------------------*/

// app.use((_req: Request, res: Response, next: NextFunction) => {
//   if (mongoose.connection.readyState !== 1) {
//     return res.status(503).json({ error: "Database not connected yet" });
//   }
//   next();
// });

/* ───────────── Health check endpoint ───────────── */

app.get("/health", (_req: Request, res: Response) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: Date.now(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  };

  try {
    res.status(200).json(healthCheck);
  } catch (error) {
    healthCheck.message = "Error";
    res.status(503).json(healthCheck);
  }
});

/* ───────────── API routes ───────────── */

app.use("/api/comments", commentRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/bias", biasRoutes);
app.use("/api/orchestrator", orchestratorRoutes);

/* ───────────── 404 & error handling ───────────── */

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
  ) => {
    console.error("Global error handler:", err.stack);
    res.status(500).json({
      error: "An internal server error occurred",
      details: err.message,
    });
  },
);

export default app;
