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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchArticlesFromNewsAPI = void 0;
var axios_1 = require("axios");
var dotenv = require("dotenv");
var PAGE_SIZE = 100;
var STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|eot|ttf|otf|json|webmanifest|xml|rss|atom|mp4|mpeg|mov|zip|gz|pdf)(\?|$)/i;
dotenv.config();
/* ─────────── helper to rotate keys ─────────── */
var NEWS_KEYS = [
  process.env.NEWS_API_KEY,
  process.env.NEWS_API_KEY1,
  process.env.NEWS_API_KEY2,
  process.env.NEWS_API_KEY3,
  process.env.NEWS_API_KEY4,
  process.env.NEWS_API_KEY5,
  process.env.NEWS_API_KEY6,
  process.env.NEWS_API_KEY7,
].filter(Boolean);
if (!NEWS_KEYS.length) throw new Error("No NEWS_API_KEY* provided");
var keyIdx = 0;
/**
 * Rotate to the next NewsAPI key.
 */
var nextKey = function () {
  keyIdx = (keyIdx + 1) % NEWS_KEYS.length;
  return NEWS_KEYS[keyIdx];
};
/**
 * Get the articles from the NewsAPI with key rotation.
 *
 * @param urlBase - The base URL for the API request.
 */
function safeGet(urlBase) {
  var _a;
  return __awaiter(this, void 0, void 0, function () {
    var tries, url, err_1, ax, status_1;
    return __generator(this, function (_b) {
      switch (_b.label) {
        case 0:
          tries = 0;
          _b.label = 1;
        case 1:
          if (!(tries < NEWS_KEYS.length)) return [3 /*break*/, 6];
          url = "".concat(urlBase, "&apiKey=").concat(NEWS_KEYS[keyIdx]);
          _b.label = 2;
        case 2:
          _b.trys.push([2, 4, , 5]);
          return [4 /*yield*/, axios_1.default.get(url)];
        case 3:
          return [2 /*return*/, _b.sent()];
        case 4:
          err_1 = _b.sent();
          ax = err_1;
          status_1 =
            ((_a = ax.response) === null || _a === void 0
              ? void 0
              : _a.status) || 0;
          if (status_1 === 401 || status_1 === 429) {
            console.warn(
              "\uD83D\uDD11 rotate NewsAPI key \u2192 ".concat(
                (keyIdx + 1) % NEWS_KEYS.length,
              ),
            );
            nextKey();
            tries++;
            return [3 /*break*/, 1];
          }
          throw err_1;
        case 5:
          return [3 /*break*/, 1];
        case 6:
          throw new Error("All NewsAPI keys exhausted");
      }
    });
  });
}
/**
 * Fetch articles from the NewsAPI.
 *
 * @returns An array of articles.
 */
var fetchArticlesFromNewsAPI = function () {
  return __awaiter(void 0, void 0, void 0, function () {
    var domains,
      query,
      base,
      firstResp,
      total,
      totalPages,
      first,
      pages,
      p,
      chunks,
      CONC,
      i,
      batch,
      resps;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          domains =
            "nytimes.com,washingtonpost.com,dallasnews.com,statesman.com,houstonchronicle.com,expressnews.com";
          query = encodeURIComponent("politics OR government OR election");
          base =
            "https://newsapi.org/v2/everything?language=en&q=".concat(query) +
            "&sortBy=publishedAt&domains="
              .concat(domains, "&pageSize=")
              .concat(PAGE_SIZE);
          return [4 /*yield*/, safeGet("".concat(base, "&page=1"))];
        case 1:
          firstResp = _a.sent();
          total = firstResp.data.totalResults || 0;
          totalPages = Math.ceil(total / PAGE_SIZE);
          first = firstResp.data.articles
            .filter(function (a) {
              return !STATIC_EXT_RE.test(a.url) && !a.url.includes("#");
            })
            .map(function (a) {
              return {
                url: a.url,
                title: a.title,
                content: a.content || a.description || "",
                source: a.source.name || "NewsAPI",
              };
            });
          pages = [];
          for (p = 2; p <= totalPages; p++) pages.push(p);
          chunks = [];
          CONC = 5;
          i = 0;
          _a.label = 2;
        case 2:
          if (!(i < pages.length)) return [3 /*break*/, 5];
          batch = pages.slice(i, i + CONC);
          return [
            4 /*yield*/,
            Promise.all(
              batch.map(function (page) {
                return __awaiter(void 0, void 0, void 0, function () {
                  var resp;
                  return __generator(this, function (_a) {
                    switch (_a.label) {
                      case 0:
                        return [
                          4 /*yield*/,
                          safeGet("".concat(base, "&page=").concat(page)),
                        ];
                      case 1:
                        resp = _a.sent();
                        return [
                          2 /*return*/,
                          resp.data.articles
                            .filter(function (x) {
                              return (
                                !STATIC_EXT_RE.test(x.url) &&
                                !x.url.includes("#")
                              );
                            })
                            .map(function (x) {
                              return {
                                url: x.url,
                                title: x.title,
                                content: x.content || x.description || "",
                                source: x.source.name || "NewsAPI",
                              };
                            }),
                        ];
                    }
                  });
                });
              }),
            ),
          ];
        case 3:
          resps = _a.sent();
          chunks.push.apply(chunks, resps);
          _a.label = 4;
        case 4:
          i += CONC;
          return [3 /*break*/, 2];
        case 5:
          return [
            2 /*return*/,
            __spreadArray(__spreadArray([], first, true), chunks.flat(), true),
          ];
      }
    });
  });
};
exports.fetchArticlesFromNewsAPI = fetchArticlesFromNewsAPI;
