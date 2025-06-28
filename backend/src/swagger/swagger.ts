import swaggerJSDoc from "swagger-jsdoc";
import path from "path";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "SynthoraAI - AI Article Curator API",
    version: "1.0.0",
    description: "API Documentation for Synthora AI - AI Article Curator",
  },
  servers: [
    {
      url: "https://ai-content-curator-backend.vercel.app",
      description: "Production server",
    },
    {
      url: "http://localhost:3000",
      description: "Local server",
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Enter your token directly (without 'Bearer ').",
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [
    path.resolve(__dirname, "../routes/*.ts"),
    path.resolve(__dirname, "../models/*.ts"),
    path.resolve(__dirname, "../routes/*.js"),
    path.resolve(__dirname, "../models/*.js"),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
