"use strict";

const axios = require("axios");

const MODEL_ENDPOINT = "https://generativelanguage.googleapis.com/v1/models";
const DEFAULT_MODEL_CACHE_TTL_MS = 600000;

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

let cachedModels = null;
let cacheExpiresAt = 0;
let inflight = null;

function getGeminiApiKeys() {
  return [
    process.env.GOOGLE_AI_API_KEY,
    process.env.GOOGLE_AI_API_KEY1,
    process.env.GOOGLE_AI_API_KEY2,
    process.env.GOOGLE_AI_API_KEY3,
  ].filter(Boolean);
}

function normalizeModelName(name) {
  return name.replace(/^models\//, "").trim();
}

function isAllowedGeminiModel(name, supportedGenerationMethods) {
  const lower = name.toLowerCase();
  if (!lower.includes("gemini")) return false;
  if (lower.includes("embedding")) return false;
  if (lower.includes("pro")) return false;
  if (supportedGenerationMethods && supportedGenerationMethods.length) {
    return supportedGenerationMethods.includes("generateContent");
  }
  return true;
}

function parseModelOverrides() {
  const raw = process.env.GEMINI_MODELS;
  if (!raw) return null;
  const models = raw
    .split(",")
    .map((m) => normalizeModelName(m))
    .filter(Boolean)
    .filter((name) => isAllowedGeminiModel(name));
  return models.length ? models : null;
}

function getCacheTtlMs() {
  return (
    parseInt(process.env.GEMINI_MODEL_CACHE_MS ?? "", 10) ||
    DEFAULT_MODEL_CACHE_TTL_MS
  );
}

async function fetchModelsForKey(key) {
  const resp = await axios.get(MODEL_ENDPOINT, {
    params: { key },
    timeout: 8000,
  });
  const models = (resp.data && resp.data.models) || [];
  const filtered = models
    .map((model) => ({
      name: normalizeModelName(model.name || ""),
      methods: model.supportedGenerationMethods || [],
    }))
    .filter((model) => isAllowedGeminiModel(model.name, model.methods))
    .map((model) => model.name);
  return Array.from(new Set(filtered));
}

async function getGeminiModels(apiKeys = getGeminiApiKeys()) {
  const overrides = parseModelOverrides();
  if (overrides) return overrides;

  if (process.env.NODE_ENV === "test") {
    return [...FALLBACK_MODELS];
  }

  if (cachedModels && Date.now() < cacheExpiresAt) {
    return cachedModels;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    for (const key of apiKeys) {
      try {
        const models = await fetchModelsForKey(key);
        if (models.length) {
          cachedModels = models;
          cacheExpiresAt = Date.now() + getCacheTtlMs();
          return models;
        }
      } catch {
        continue;
      }
    }

    return cachedModels ?? [...FALLBACK_MODELS];
  })();

  const result = await inflight;
  inflight = null;
  return result;
}

module.exports = { getGeminiModels, getGeminiApiKeys };
