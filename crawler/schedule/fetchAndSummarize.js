#!/usr/bin/env ts-node
"use strict";
/**
 * schedule/fetchAndSummarize.ts
 *
 * End‑to‑end pipeline:
 *  1. Crawl homepages (BFS, depth/link bounded)
 *  2. Pull headlines from NewsAPI
 *  3. De‑dupe (DB + in‑process)
 *  4. Fetch full article (static → dynamic)
 *  5. Summarize + topic‑tag (key/model rotation)
 *  6. Upsert into Mongo
 */
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
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
var __spreadArray =
  (this && this.__spreadArray) ||
  function (to, from, pack) {
    if (pack || arguments.length === 2)
      for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
var _a, _b, _c, _d, _e, _f, _g, _h;
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAndSummarize = void 0;
var mongoose_1 = require("mongoose");
var dotenv = require("dotenv");
var article_model_1 = require("../models/article.model");
var crawler_service_1 = require("../services/crawler.service");
var apiFetcher_service_1 = require("../services/apiFetcher.service");
var summarization_service_1 = require("../services/summarization.service");
var topicExtractor_service_1 = require("../services/topicExtractor.service");
var logger_1 = require("../utils/logger");
var cleanData_1 = require("../scripts/cleanData");
dotenv.config();
mongoose_1.default.set("strictQuery", false);
/* ─────────────────── ENV / CONFIG ─────────────────── */
var MONGODB_URI =
  (_a = process.env.MONGODB_URI) !== null && _a !== void 0 ? _a : "";
if (!MONGODB_URI) throw new Error("MONGODB_URI must be defined");
var HOMEPAGE_URLS = (
  (_b = process.env.CRAWL_URLS) !== null && _b !== void 0 ? _b : ""
)
  .split(",")
  .map(function (u) {
    return u.trim();
  })
  .filter(Boolean);
var CRAWL_MAX_LINKS = parseInt(
  (_c = process.env.CRAWL_MAX_LINKS) !== null && _c !== void 0 ? _c : "40",
  10,
);
var CRAWL_MAX_DEPTH = parseInt(
  (_d = process.env.CRAWL_MAX_DEPTH) !== null && _d !== void 0 ? _d : "2",
  10,
);
var CRAWL_CONCURRENCY = parseInt(
  (_e = process.env.CRAWL_CONCURRENCY) !== null && _e !== void 0 ? _e : "3",
  10,
);
var FETCH_CONCURRENCY = parseInt(
  (_f = process.env.FETCH_CONCURRENCY) !== null && _f !== void 0 ? _f : "5",
  10,
);
var DELAY_BETWEEN_REQUESTS_MS = parseInt(
  (_g = process.env.DELAY_BETWEEN_REQUESTS_MS) !== null && _g !== void 0
    ? _g
    : "1000",
  10,
);
var MAX_FETCH_TIME_MS = parseInt(
  (_h = process.env.MAX_FETCH_TIME_MS) !== null && _h !== void 0 ? _h : "60000",
  10,
);
var STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|eot|ttf|otf|json|webmanifest|xml|rss|atom|mp4|mpeg|mov|zip|gz|pdf)(\?|$)/i;
var wait = function (ms) {
  return new Promise(function (r) {
    return setTimeout(r, ms);
  });
};
/* ─────────────────── DUPLICATE‑SAFE UPSERT ─────────────────── */
/**
 * Upsert an article into the database.
 * If the article already exists, it will be skipped.
 *
 * @param data - The article data to upsert.
 */
function upsertArticle(data) {
  return __awaiter(this, void 0, void 0, function () {
    var res;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          return [
            4 /*yield*/,
            article_model_1.default.updateOne(
              { url: data.url },
              {
                $setOnInsert: __assign(__assign({}, data), {
                  fetchedAt: new Date(),
                }),
              },
              { upsert: true },
            ),
          ];
        case 1:
          res = _a.sent();
          if (res.upsertedCount) {
            logger_1.default.info(
              "\u2705 Saved: ".concat(data.title || data.url),
            );
          } else {
            logger_1.default.debug(
              "\uD83D\uDD04 Skipped duplicate: ".concat(data.url),
            );
          }
          return [2 /*return*/];
      }
    });
  });
}
/* ─────────────────── IN‑MEMORY CONCURRENCY GUARD ─────────────────── */
var processingUrls = new Set();
/**
 * Start processing a URL. If it's already being processed, return false.
 *
 * @param url - The URL to process.
 * @returns true if the URL is now being processed, false if it was already in process.
 */
function startProcessing(url) {
  if (processingUrls.has(url)) return false;
  processingUrls.add(url);
  return true;
}
/**
 * Mark a URL as done processing.
 *
 * @param url - The URL that has finished processing.
 */
function doneProcessing(url) {
  processingUrls.delete(url);
}
/* ─────────────────── NEWS‑API ARTICLES ─────────────────── */
/**
 * Process an article from the NewsAPI.
 *
 * @param api - The article data from the API.
 */
function processApiArticle(api) {
  var _a, _b, _c;
  return __awaiter(this, void 0, void 0, function () {
    var text, summary, topics, err_1;
    return __generator(this, function (_d) {
      switch (_d.label) {
        case 0:
          if (
            STATIC_EXT_RE.test(api.url) ||
            api.url.includes("#") ||
            !startProcessing(api.url)
          )
            return [2 /*return*/];
          _d.label = 1;
        case 1:
          _d.trys.push([1, 5, 6, 7]);
          text = (api.content || api.description || "").trim();
          if (!text) {
            logger_1.default.warn(
              "API article ".concat(api.url, " has no text"),
            );
            return [2 /*return*/];
          }
          return [
            4 /*yield*/,
            (0, summarization_service_1.summarizeContent)(text),
          ];
        case 2:
          summary = _d.sent();
          return [
            4 /*yield*/,
            (0, topicExtractor_service_1.extractTopics)(summary),
          ];
        case 3:
          topics = _d.sent();
          return [
            4 /*yield*/,
            upsertArticle({
              url: api.url,
              title:
                (_a = api.title) !== null && _a !== void 0 ? _a : "(no title)",
              content: text,
              summary: summary,
              topics: topics,
              source:
                (_c =
                  (_b = api.source) === null || _b === void 0
                    ? void 0
                    : _b.name) !== null && _c !== void 0
                  ? _c
                  : "newsapi",
            }),
          ];
        case 4:
          _d.sent();
          return [3 /*break*/, 7];
        case 5:
          err_1 = _d.sent();
          logger_1.default.error(
            "Error processing API article ".concat(api.url, ":"),
            err_1,
          );
          return [3 /*break*/, 7];
        case 6:
          doneProcessing(api.url);
          return [7 /*endfinally*/];
        case 7:
          return [2 /*return*/];
      }
    });
  });
}
/* ─────────────────── PAGE‑FETCH ARTICLES ─────────────────── */
/**
 * Process a URL to fetch and summarize its content.
 *
 * @param url - The URL to process.
 */
function processUrl(url) {
  return __awaiter(this, void 0, void 0, function () {
    var art, e_1, summary, topics, err_2;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          if (
            STATIC_EXT_RE.test(url) ||
            url.includes("#") ||
            !startProcessing(url)
          )
            return [2 /*return*/];
          _a.label = 1;
        case 1:
          _a.trys.push([1, 11, 12, 13]);
          art = void 0;
          _a.label = 2;
        case 2:
          _a.trys.push([2, 4, , 6]);
          return [
            4 /*yield*/,
            Promise.race([
              (0, crawler_service_1.fetchStaticArticle)(url),
              new Promise(function (_, r) {
                return setTimeout(function () {
                  return r(new Error("static timeout"));
                }, MAX_FETCH_TIME_MS);
              }),
            ]),
          ];
        case 3:
          art = _a.sent();
          return [3 /*break*/, 6];
        case 4:
          e_1 = _a.sent();
          logger_1.default.warn(
            "static FAIL ".concat(url, ": ").concat(e_1, ". Trying dynamic."),
          );
          return [4 /*yield*/, (0, crawler_service_1.fetchDynamicArticle)(url)];
        case 5:
          art = _a.sent();
          return [3 /*break*/, 6];
        case 6:
          if (!art.content.trim()) {
            logger_1.default.warn("No content ".concat(url));
            return [2 /*return*/];
          }
          return [
            4 /*yield*/,
            (0, summarization_service_1.summarizeContent)(art.content),
          ];
        case 7:
          summary = _a.sent();
          return [
            4 /*yield*/,
            (0, topicExtractor_service_1.extractTopics)(summary),
          ];
        case 8:
          topics = _a.sent();
          // 3) Upsert
          return [
            4 /*yield*/,
            upsertArticle({
              url: art.url,
              title: art.title,
              content: art.content,
              summary: summary,
              topics: topics,
              source: art.source,
            }),
          ];
        case 9:
          // 3) Upsert
          _a.sent();
          return [4 /*yield*/, wait(DELAY_BETWEEN_REQUESTS_MS)];
        case 10:
          _a.sent();
          return [3 /*break*/, 13];
        case 11:
          err_2 = _a.sent();
          logger_1.default.error(
            "Full\u2011article pipeline failed ".concat(url, ":"),
            err_2,
          );
          return [3 /*break*/, 13];
        case 12:
          doneProcessing(url);
          return [7 /*endfinally*/];
        case 13:
          return [2 /*return*/];
      }
    });
  });
}
/* ─────────────────── MAIN ─────────────────── */
/**
 * Fetch and summarize articles from various sources.
 */
function fetchAndSummarize() {
  return __awaiter(this, void 0, void 0, function () {
    var crawlJobs,
      i,
      crawledRaw,
      crawled,
      apiArticles,
      err_3,
      allUrls,
      already,
      alreadySet,
      toFetch,
      i,
      slice;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          return [4 /*yield*/, mongoose_1.default.connect(MONGODB_URI)];
        case 1:
          _a.sent();
          logger_1.default.info("✅ Mongo connected");
          /* 1. Crawl homepages */
          logger_1.default.info("🔍 Crawling homepages…");
          crawlJobs = [];
          for (i = 0; i < HOMEPAGE_URLS.length; i += CRAWL_CONCURRENCY) {
            crawlJobs.push.apply(
              crawlJobs,
              HOMEPAGE_URLS.slice(i, i + CRAWL_CONCURRENCY).map(function (u) {
                return (0, crawler_service_1.crawlArticlesFromHomepage)(
                  u,
                  CRAWL_MAX_LINKS,
                  CRAWL_MAX_DEPTH,
                );
              }),
            );
          }
          return [4 /*yield*/, Promise.all(crawlJobs)];
        case 2:
          crawledRaw = _a.sent().flat();
          crawled = crawledRaw.filter(function (u) {
            return !STATIC_EXT_RE.test(u) && !u.includes("#");
          });
          logger_1.default.info(
            "\uD83D\uDD17 Crawled ".concat(crawled.length, " links"),
          );
          /* 2. NewsAPI */
          logger_1.default.info("📰 Pulling NewsAPI…");
          apiArticles = [];
          _a.label = 3;
        case 3:
          _a.trys.push([3, 5, , 6]);
          return [
            4 /*yield*/,
            (0, apiFetcher_service_1.fetchArticlesFromNewsAPI)(),
          ];
        case 4:
          apiArticles = _a.sent();
          return [3 /*break*/, 6];
        case 5:
          err_3 = _a.sent();
          logger_1.default.error("NewsAPI error:", err_3);
          return [3 /*break*/, 6];
        case 6:
          /* 3. Process API articles */
          return [
            4 /*yield*/,
            Promise.allSettled(apiArticles.map(processApiArticle)),
          ];
        case 7:
          /* 3. Process API articles */
          _a.sent();
          allUrls = Array.from(
            new Set(
              __spreadArray(
                __spreadArray([], crawled, true),
                apiArticles.map(function (a) {
                  return a.url;
                }),
                true,
              ),
            ),
          );
          return [
            4 /*yield*/,
            article_model_1.default
              .find({ url: { $in: allUrls } }, "url")
              .lean(),
          ];
        case 8:
          already = _a.sent();
          alreadySet = new Set(
            already.map(function (d) {
              return d.url;
            }),
          );
          toFetch = allUrls.filter(function (u) {
            return !alreadySet.has(u);
          });
          logger_1.default.info(
            "\uD83C\uDD95 ".concat(
              toFetch.length,
              " fresh URLs to page\u2011fetch",
            ),
          );
          i = 0;
          _a.label = 9;
        case 9:
          if (!(i < toFetch.length)) return [3 /*break*/, 12];
          slice = toFetch.slice(i, i + FETCH_CONCURRENCY);
          return [4 /*yield*/, Promise.allSettled(slice.map(processUrl))];
        case 10:
          _a.sent();
          _a.label = 11;
        case 11:
          i += FETCH_CONCURRENCY;
          return [3 /*break*/, 9];
        case 12:
          if (!processingUrls.size) return [3 /*break*/, 14];
          logger_1.default.debug(
            "\u23F3 waiting for ".concat(
              processingUrls.size,
              " in\u2011flight jobs\u2026",
            ),
          );
          return [4 /*yield*/, wait(1000)];
        case 13:
          _a.sent();
          return [3 /*break*/, 12];
        case 14:
          /* 7. Cleanup */
          logger_1.default.info("🧹 Cleaning up...");
          return [4 /*yield*/, (0, cleanData_1.cleanupArticles)()];
        case 15:
          _a.sent();
          logger_1.default.info("🏁 Pipeline complete");
          return [2 /*return*/];
      }
    });
  });
}
exports.fetchAndSummarize = fetchAndSummarize;
// Run the script if executed directly
if (require.main === module) {
  fetchAndSummarize()
    .then(function () {
      logger_1.default.info("🎉 fetchAndSummarize finished");
      process.exit(0);
    })
    .catch(function (err) {
      logger_1.default.error("💥 fetchAndSummarize crashed:", err);
      process.exit(1);
    });
}
