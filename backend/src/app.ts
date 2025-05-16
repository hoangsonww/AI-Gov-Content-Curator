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

import swaggerDocs from "./swagger/swagger";
import swaggerUi from "swagger-ui-express";

dotenv.config();

const app = express();

// Connect to MongoDB using URI from .env
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mydb";
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

app.use(cors({ origin: "*" }));
app.use(express.json());

// Serve favicon from public folder
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

// ----------------- Swagger Setup -----------------
app.get("/swagger.json", (req: Request, res: Response) => {
  res.json(swaggerDocs);
});

app.get("/api-docs", (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Article Curator API Docs</title>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
        <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@4.15.5/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@4.15.5/favicon-16x16.png" sizes="16x16" />
        <style>
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = function() {
            const ui = SwaggerUIBundle({
              url: '/swagger.json',
              dom_id: '#swagger-ui',
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              layout: "StandaloneLayout"
            });
            window.ui = ui;
          }
        </script>
      </body>
    </html>
  `);
});

// Redirect root "/" to "/api-docs"
app.get("/", (req: Request, res: Response) => {
  res.redirect("/api-docs");
});

// ----------------- Logging Middleware -----------------
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ----------------- API Routes -----------------
app.use("/api/articles", articleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/newsletter", newsletterRoutes);

// 404 for unsupported routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Global error handler:", err.stack);
  res
    .status(500)
    .json({ error: "An internal server error occurred", details: err.message });
});

export default app;
