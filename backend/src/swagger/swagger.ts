const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Article Curator API",
    version: "1.0.0",
    description: "API documentation for the Article Curator backend",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local server",
    },
  ],
  components: {
    schemas: {
      Article: {
        type: "object",
        properties: {
          _id: { type: "string" },
          url: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          summary: { type: "string" },
          source: { type: "string" },
          fetchedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/api/articles": {
      get: {
        summary: "Retrieve a list of articles",
        parameters: [
          {
            in: "query",
            name: "page",
            schema: { type: "integer" },
            description: "Page number for pagination",
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer" },
            description: "Number of articles per page",
          },
          {
            in: "query",
            name: "source",
            schema: { type: "string" },
            description: "Filter articles by source",
          },
        ],
        responses: {
          200: {
            description: "A list of articles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Article" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
          500: { description: "Failed to fetch articles" },
        },
      },
    },
    "/api/articles/{id}": {
      get: {
        summary: "Retrieve a single article by ID",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
            description: "The article ID",
          },
        ],
        responses: {
          200: {
            description: "An article object",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Article" },
              },
            },
          },
          404: { description: "Article not found" },
          500: { description: "Failed to fetch article" },
        },
      },
    },
  },
};

export default swaggerDefinition;
