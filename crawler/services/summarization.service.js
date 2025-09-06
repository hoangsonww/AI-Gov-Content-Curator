"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                    ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeContent = void 0;
var generative_ai_1 = require("@google/generative-ai");
var dotenv = require("dotenv");
dotenv.config();
/* ─────────────────  KEY + MODEL ROTATION ───────────────── */
var API_KEYS = [
  process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY1,
  process.env.GOOGLE_AI_API_KEY2,
  process.env.GOOGLE_AI_API_KEY3,
].filter(Boolean);
if (!API_KEYS.length) throw new Error("No GOOGLE_AI_API_KEY* values found");
var MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
var MAX_RETRIES_PER_PAIR = 2;
var BACKOFF_MS = 1500;
/* ─────────────────  PARAMS ───────────────── */
var SYSTEM = (
  (_a = process.env.AI_INSTRUCTIONS) !== null && _a !== void 0 ? _a : ""
).trim();
var generationConfig = {
  temperature: 0.9,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};
var safetySettings = [
  {
    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE,
  },
];
/**
 * Check if the error is due to rate limiting or quota exceeded.
 *
 * @param e - The error object.
 */
var isRateOrQuota = function (e) {
  return (
    (e === null || e === void 0 ? void 0 : e.status) === 429 ||
    /quota|rate|exceed/i.test(
      (e === null || e === void 0 ? void 0 : e.message) || "",
    )
  );
};
/**
 * Check if the error is due to overload or service unavailability.
 *
 * @param e - The error object.
 */
var isOverloaded = function (e) {
  return (
    (e === null || e === void 0 ? void 0 : e.status) === 503 ||
    /overload|unavailable/i.test(
      (e === null || e === void 0 ? void 0 : e.message) || "",
    )
  );
};
/* ─────────────────────────────  EXPORT  ───────────────────────────── */
/**
 * Summarize the content of an article using Google Generative AI.
 *
 * @param article - The article content to summarize.
 * @returns The summarized text.
 */
function summarizeContent(article) {
  var _a, _b;
  return __awaiter(this, void 0, void 0, function () {
    var _i,
      API_KEYS_1,
      key,
      _c,
      MODELS_1,
      model,
      genAI,
      _loop_1,
      attempt,
      state_1;
    return __generator(this, function (_d) {
      switch (_d.label) {
        case 0:
          (_i = 0), (API_KEYS_1 = API_KEYS);
          _d.label = 1;
        case 1:
          if (!(_i < API_KEYS_1.length)) return [3 /*break*/, 8];
          key = API_KEYS_1[_i];
          (_c = 0), (MODELS_1 = MODELS);
          _d.label = 2;
        case 2:
          if (!(_c < MODELS_1.length)) return [3 /*break*/, 7];
          model = MODELS_1[_c];
          genAI = new generative_ai_1.GoogleGenerativeAI(
            key,
          ).getGenerativeModel({
            model: model,
            systemInstruction: SYSTEM,
          });
          _loop_1 = function (attempt) {
            var result, text, err_1;
            return __generator(this, function (_e) {
              switch (_e.label) {
                case 0:
                  _e.trys.push([0, 2, , 5]);
                  return [
                    4 /*yield*/,
                    genAI.generateContent({
                      contents: [
                        {
                          role: "user",
                          parts: [
                            { text: "Summarize briefly:\n\n".concat(article) },
                          ],
                        },
                      ],
                      generationConfig: generationConfig,
                      safetySettings: safetySettings,
                    }),
                  ];
                case 1:
                  result = _e.sent();
                  text =
                    (_b =
                      (_a =
                        result === null || result === void 0
                          ? void 0
                          : result.response) === null || _a === void 0
                        ? void 0
                        : _a.text) === null || _b === void 0
                      ? void 0
                      : _b.call(_a).trim();
                  if (!text) throw new Error("Empty Gemini response");
                  return [2 /*return*/, { value: text }];
                case 2:
                  err_1 = _e.sent();
                  if (
                    !(
                      (isRateOrQuota(err_1) || isOverloaded(err_1)) &&
                      attempt < MAX_RETRIES_PER_PAIR
                    )
                  )
                    return [3 /*break*/, 4];
                  return [
                    4 /*yield*/,
                    new Promise(function (r) {
                      return setTimeout(r, BACKOFF_MS * attempt);
                    }),
                  ];
                case 3:
                  _e.sent();
                  return [2 /*return*/, "continue"];
                case 4:
                  return [3 /*break*/, 5];
                case 5:
                  return [2 /*return*/];
              }
            });
          };
          attempt = 1;
          _d.label = 3;
        case 3:
          if (!(attempt <= MAX_RETRIES_PER_PAIR)) return [3 /*break*/, 6];
          return [5 /*yield**/, _loop_1(attempt)];
        case 4:
          state_1 = _d.sent();
          if (typeof state_1 === "object") return [2 /*return*/, state_1.value];
          _d.label = 5;
        case 5:
          attempt++;
          return [3 /*break*/, 3];
        case 6:
          _c++;
          return [3 /*break*/, 2];
        case 7:
          _i++;
          return [3 /*break*/, 1];
        case 8:
          throw new Error("All keys/models exhausted while summarizing");
      }
    });
  });
}
exports.summarizeContent = summarizeContent;
