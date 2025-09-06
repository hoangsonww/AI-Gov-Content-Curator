#!/usr/bin/env ts-node
"use strict";
/* eslint-disable no-console */
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
var __asyncValues =
  (this && this.__asyncValues) ||
  function (o) {
    if (!Symbol.asyncIterator)
      throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator],
      i;
    return m
      ? m.call(o)
      : ((o =
          typeof __values === "function" ? __values(o) : o[Symbol.iterator]()),
        (i = {}),
        verb("next"),
        verb("throw"),
        verb("return"),
        (i[Symbol.asyncIterator] = function () {
          return this;
        }),
        i);
    function verb(n) {
      i[n] =
        o[n] &&
        function (v) {
          return new Promise(function (resolve, reject) {
            (v = o[n](v)), settle(resolve, reject, v.done, v.value);
          });
        };
    }
    function settle(resolve, reject, d, v) {
      Promise.resolve(v).then(function (v) {
        resolve({ value: v, done: d });
      }, reject);
    }
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupArticles = void 0;
var dotenv = require("dotenv");
dotenv.config();
var mongoose_1 = require("mongoose");
/* ─────────── Mongo model (minimal shape) ─────────── */
var ArticleSchema = new mongoose_1.Schema({
  url: String,
  title: String,
  content: String,
  summary: String,
  topics: [String],
  source: String,
  fetchedAt: Date,
});
// Avoids OverwriteModelError by reusing existing model if already defined
var Article =
  mongoose_1.default.models.Article ||
  mongoose_1.default.model("Article", ArticleSchema);
/* ─────────── ENV ─────────── */
var _a = process.env.MONGODB_URI,
  MONGODB_URI = _a === void 0 ? "" : _a;
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is required");
}
/* ─────────── Heuristic patterns ─────────── */
/** 1) Non-article URLs (assets, share intents) */
var STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|json|xml|webmanifest|pdf|zip|gz|mp4|mpeg|mov)(\?|$)/i;
var SHARE_URL_RE =
  /(twitter\.com\/intent|x\.com\/intent|facebook\.com\/sharer|linkedin\.com\/share|pinterest\.com\/pin\/create)/i;
/** 2) Pages that are clearly errors or placeholders */
var ERROR_TITLE_RE =
  /\b(page\s+(?:not\s+found|unavailable)|404\s+error|error\s+404|oops!|access\s+denied|forbidden|blocked)\b/i;
var ERROR_CONTENT_RE =
  /(STATUS CODE:\s*404|does not exist|currently unavailable|404\s*error|page not found|access denied|forbidden|internal server error|http 403|http 404|http 500)/i;
/** 3) Boilerplate apology / inability text */
var BOILERPLATE_RE =
  /\b(I am sorry|unable to (?:access|summarize|process|retrieve))\b/i;
/** 4) Too-short content threshold */
var SHORT_CONTENT_LEN = 200;
/** 5) Detect binary/control characters in the first 100 chars */
function looksBinary(txt) {
  if (txt === void 0) {
    txt = "";
  }
  return /[\u0000-\u001F]/.test(txt.slice(0, 100));
}
/**
 * Connects to Mongo (if needed), deletes unmeaningful articles by a series
 * of heuristics, then normalizes odd titles, cleans repeated or garbled
 * suffixes, strips camel-case concatenated suffixes, then disconnects (only
 * if it opened the connection). Logs each phase’s result.
 */
function cleanupArticles() {
  var _a,
    e_1,
    _b,
    _c,
    _d,
    e_2,
    _e,
    _f,
    _g,
    e_3,
    _h,
    _j,
    _k,
    e_4,
    _l,
    _m,
    _o,
    e_5,
    _p,
    _q;
  return __awaiter(this, void 0, void 0, function () {
    var alreadyConnected,
      urlDeleted,
      toDelete,
      cursor,
      _r,
      cursor_1,
      cursor_1_1,
      doc,
      title,
      content,
      summary,
      isUntitled,
      tooShort,
      isBinary,
      isErrorish,
      isBoiler,
      e_1_1,
      heurDeleted,
      _s,
      repeaterBulk,
      cursor3,
      _t,
      cursor3_1,
      cursor3_1_1,
      doc,
      orig,
      dupMatch,
      cleaned,
      e_2_1,
      res,
      camelBulk,
      cursor4,
      _loop_1,
      _u,
      cursor4_1,
      cursor4_1_1,
      e_3_1,
      res,
      suffixBulk,
      cursor5,
      TRAILING_UPPER_RE,
      _v,
      cursor5_1,
      cursor5_1_1,
      doc,
      orig,
      cleaned,
      e_4_1,
      res,
      ODD_TITLE_RE,
      bulkOps,
      cursor6,
      _w,
      cursor6_1,
      cursor6_1_1,
      doc,
      rawTitle,
      cleaned,
      e_5_1,
      res;
    return __generator(this, function (_x) {
      switch (_x.label) {
        case 0:
          alreadyConnected = mongoose_1.default.connection.readyState === 1;
          if (!!alreadyConnected) return [3 /*break*/, 2];
          return [4 /*yield*/, mongoose_1.default.connect(MONGODB_URI)];
        case 1:
          _x.sent();
          console.log("✅ MongoDB connected");
          return [3 /*break*/, 3];
        case 2:
          console.log("🔄 Reusing existing MongoDB connection");
          _x.label = 3;
        case 3:
          return [
            4 /*yield*/,
            Article.deleteMany({
              $or: [
                { url: { $regex: STATIC_EXT_RE } },
                { url: { $regex: SHARE_URL_RE } },
              ],
            }),
          ];
        case 4:
          urlDeleted = _x.sent().deletedCount;
          console.log(
            "Phase 1 \u2014 removed by URL patterns: ".concat(urlDeleted),
          );
          toDelete = [];
          cursor = Article.find(
            {},
            { _id: 1, title: 1, content: 1, summary: 1 },
          )
            .lean()
            .cursor();
          _x.label = 5;
        case 5:
          _x.trys.push([5, 10, 11, 16]);
          (_r = true), (cursor_1 = __asyncValues(cursor));
          _x.label = 6;
        case 6:
          return [4 /*yield*/, cursor_1.next()];
        case 7:
          if (!((cursor_1_1 = _x.sent()), (_a = cursor_1_1.done), !_a))
            return [3 /*break*/, 9];
          _c = cursor_1_1.value;
          _r = false;
          try {
            doc = _c;
            title = (doc.title || "").trim();
            content = (doc.content || "").trim();
            summary = (doc.summary || "").trim();
            // Remove any articles containing embedded iframes or similar tags
            if (/<iframe\b/i.test(content)) {
              toDelete.push(doc._id);
              return [3 /*break*/, 8];
            }
            isUntitled = title.toLowerCase() === "untitled";
            tooShort = !title && content.length < SHORT_CONTENT_LEN;
            isBinary = looksBinary(content);
            isErrorish =
              ERROR_TITLE_RE.test(title) || ERROR_CONTENT_RE.test(content);
            isBoiler =
              BOILERPLATE_RE.test(content) || BOILERPLATE_RE.test(summary);
            if (isUntitled || tooShort || isBinary || isErrorish || isBoiler) {
              toDelete.push(doc._id);
            }
          } finally {
            _r = true;
          }
          _x.label = 8;
        case 8:
          return [3 /*break*/, 6];
        case 9:
          return [3 /*break*/, 16];
        case 10:
          e_1_1 = _x.sent();
          e_1 = { error: e_1_1 };
          return [3 /*break*/, 16];
        case 11:
          _x.trys.push([11, , 14, 15]);
          if (!(!_r && !_a && (_b = cursor_1.return))) return [3 /*break*/, 13];
          return [4 /*yield*/, _b.call(cursor_1)];
        case 12:
          _x.sent();
          _x.label = 13;
        case 13:
          return [3 /*break*/, 15];
        case 14:
          if (e_1) throw e_1.error;
          return [7 /*endfinally*/];
        case 15:
          return [7 /*endfinally*/];
        case 16:
          if (!toDelete.length) return [3 /*break*/, 18];
          return [4 /*yield*/, Article.deleteMany({ _id: { $in: toDelete } })];
        case 17:
          _s = _x.sent();
          return [3 /*break*/, 19];
        case 18:
          _s = { deletedCount: 0 };
          _x.label = 19;
        case 19:
          heurDeleted = _s.deletedCount;
          console.log(
            "Phase 2 \u2014 removed by content/title heuristics & embeds: ".concat(
              heurDeleted,
            ),
          );
          repeaterBulk = [];
          cursor3 = Article.find({}, { _id: 1, title: 1 }).lean().cursor();
          _x.label = 20;
        case 20:
          _x.trys.push([20, 25, 26, 31]);
          (_t = true), (cursor3_1 = __asyncValues(cursor3));
          _x.label = 21;
        case 21:
          return [4 /*yield*/, cursor3_1.next()];
        case 22:
          if (!((cursor3_1_1 = _x.sent()), (_d = cursor3_1_1.done), !_d))
            return [3 /*break*/, 24];
          _f = cursor3_1_1.value;
          _t = false;
          try {
            doc = _f;
            orig = (doc.title || "").trim();
            dupMatch = orig.match(/^(.*?)([A-Za-z]{2,})\2$/);
            if (dupMatch) {
              cleaned = (dupMatch[1] + dupMatch[2]).trim();
              if (cleaned !== orig) {
                repeaterBulk.push({
                  updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { title: cleaned } },
                  },
                });
              }
            }
          } finally {
            _t = true;
          }
          _x.label = 23;
        case 23:
          return [3 /*break*/, 21];
        case 24:
          return [3 /*break*/, 31];
        case 25:
          e_2_1 = _x.sent();
          e_2 = { error: e_2_1 };
          return [3 /*break*/, 31];
        case 26:
          _x.trys.push([26, , 29, 30]);
          if (!(!_t && !_d && (_e = cursor3_1.return)))
            return [3 /*break*/, 28];
          return [4 /*yield*/, _e.call(cursor3_1)];
        case 27:
          _x.sent();
          _x.label = 28;
        case 28:
          return [3 /*break*/, 30];
        case 29:
          if (e_2) throw e_2.error;
          return [7 /*endfinally*/];
        case 30:
          return [7 /*endfinally*/];
        case 31:
          if (!repeaterBulk.length) return [3 /*break*/, 33];
          return [4 /*yield*/, Article.bulkWrite(repeaterBulk)];
        case 32:
          res = _x.sent();
          console.log(
            "Phase 3 \u2014 cleaned repeated title segments on ".concat(
              res.modifiedCount,
              " articles",
            ),
          );
          return [3 /*break*/, 34];
        case 33:
          console.log("Phase 3 — no repeated title segments found to clean");
          _x.label = 34;
        case 34:
          camelBulk = [];
          cursor4 = Article.find({}, { _id: 1, title: 1 }).lean().cursor();
          _x.label = 35;
        case 35:
          _x.trys.push([35, 40, 41, 46]);
          _loop_1 = function () {
            _j = cursor4_1_1.value;
            _u = false;
            try {
              var doc = _j;
              var orig = (doc.title || "").trim();
              var idx = orig.split("").findIndex(function (ch, i) {
                return i > 0 && /[a-z]/.test(orig[i - 1]) && /[A-Z]/.test(ch);
              });
              if (idx > 0) {
                var cleaned = orig.slice(0, idx).trim();
                if (cleaned && cleaned !== orig) {
                  camelBulk.push({
                    updateOne: {
                      filter: { _id: doc._id },
                      update: { $set: { title: cleaned } },
                    },
                  });
                }
              }
            } finally {
              _u = true;
            }
          };
          (_u = true), (cursor4_1 = __asyncValues(cursor4));
          _x.label = 36;
        case 36:
          return [4 /*yield*/, cursor4_1.next()];
        case 37:
          if (!((cursor4_1_1 = _x.sent()), (_g = cursor4_1_1.done), !_g))
            return [3 /*break*/, 39];
          _loop_1();
          _x.label = 38;
        case 38:
          return [3 /*break*/, 36];
        case 39:
          return [3 /*break*/, 46];
        case 40:
          e_3_1 = _x.sent();
          e_3 = { error: e_3_1 };
          return [3 /*break*/, 46];
        case 41:
          _x.trys.push([41, , 44, 45]);
          if (!(!_u && !_g && (_h = cursor4_1.return)))
            return [3 /*break*/, 43];
          return [4 /*yield*/, _h.call(cursor4_1)];
        case 42:
          _x.sent();
          _x.label = 43;
        case 43:
          return [3 /*break*/, 45];
        case 44:
          if (e_3) throw e_3.error;
          return [7 /*endfinally*/];
        case 45:
          return [7 /*endfinally*/];
        case 46:
          if (!camelBulk.length) return [3 /*break*/, 48];
          return [4 /*yield*/, Article.bulkWrite(camelBulk)];
        case 47:
          res = _x.sent();
          console.log(
            "Phase 4 \u2014 stripped camel-case suffixes on ".concat(
              res.modifiedCount,
              " articles",
            ),
          );
          return [3 /*break*/, 49];
        case 48:
          console.log("Phase 4 — no camel-case suffixes found to strip");
          _x.label = 49;
        case 49:
          suffixBulk = [];
          cursor5 = Article.find({}, { _id: 1, title: 1 }).lean().cursor();
          TRAILING_UPPER_RE = /[A-Z]{3,}$/;
          _x.label = 50;
        case 50:
          _x.trys.push([50, 55, 56, 61]);
          (_v = true), (cursor5_1 = __asyncValues(cursor5));
          _x.label = 51;
        case 51:
          return [4 /*yield*/, cursor5_1.next()];
        case 52:
          if (!((cursor5_1_1 = _x.sent()), (_k = cursor5_1_1.done), !_k))
            return [3 /*break*/, 54];
          _m = cursor5_1_1.value;
          _v = false;
          try {
            doc = _m;
            orig = (doc.title || "").trim();
            if (TRAILING_UPPER_RE.test(orig)) {
              cleaned = orig.replace(TRAILING_UPPER_RE, "").trim();
              if (cleaned && cleaned !== orig) {
                suffixBulk.push({
                  updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { title: cleaned } },
                  },
                });
              }
            }
          } finally {
            _v = true;
          }
          _x.label = 53;
        case 53:
          return [3 /*break*/, 51];
        case 54:
          return [3 /*break*/, 61];
        case 55:
          e_4_1 = _x.sent();
          e_4 = { error: e_4_1 };
          return [3 /*break*/, 61];
        case 56:
          _x.trys.push([56, , 59, 60]);
          if (!(!_v && !_k && (_l = cursor5_1.return)))
            return [3 /*break*/, 58];
          return [4 /*yield*/, _l.call(cursor5_1)];
        case 57:
          _x.sent();
          _x.label = 58;
        case 58:
          return [3 /*break*/, 60];
        case 59:
          if (e_4) throw e_4.error;
          return [7 /*endfinally*/];
        case 60:
          return [7 /*endfinally*/];
        case 61:
          if (!suffixBulk.length) return [3 /*break*/, 63];
          return [4 /*yield*/, Article.bulkWrite(suffixBulk)];
        case 62:
          res = _x.sent();
          console.log(
            "Phase 5 \u2014 stripped garbled suffixes on ".concat(
              res.modifiedCount,
              " articles",
            ),
          );
          return [3 /*break*/, 64];
        case 63:
          console.log("Phase 5 — no garbled suffixes found to strip");
          _x.label = 64;
        case 64:
          ODD_TITLE_RE = /^[^A-Za-z0-9]+/;
          bulkOps = [];
          cursor6 = Article.find(
            { title: { $regex: ODD_TITLE_RE } },
            { _id: 1, title: 1 },
          )
            .lean()
            .cursor();
          _x.label = 65;
        case 65:
          _x.trys.push([65, 70, 71, 76]);
          (_w = true), (cursor6_1 = __asyncValues(cursor6));
          _x.label = 66;
        case 66:
          return [4 /*yield*/, cursor6_1.next()];
        case 67:
          if (!((cursor6_1_1 = _x.sent()), (_o = cursor6_1_1.done), !_o))
            return [3 /*break*/, 69];
          _q = cursor6_1_1.value;
          _w = false;
          try {
            doc = _q;
            rawTitle = doc.title || "";
            cleaned = rawTitle.replace(ODD_TITLE_RE, "").trim();
            if (cleaned !== rawTitle) {
              bulkOps.push({
                updateOne: {
                  filter: { _id: doc._id },
                  update: { $set: { title: cleaned } },
                },
              });
            }
          } finally {
            _w = true;
          }
          _x.label = 68;
        case 68:
          return [3 /*break*/, 66];
        case 69:
          return [3 /*break*/, 76];
        case 70:
          e_5_1 = _x.sent();
          e_5 = { error: e_5_1 };
          return [3 /*break*/, 76];
        case 71:
          _x.trys.push([71, , 74, 75]);
          if (!(!_w && !_o && (_p = cursor6_1.return)))
            return [3 /*break*/, 73];
          return [4 /*yield*/, _p.call(cursor6_1)];
        case 72:
          _x.sent();
          _x.label = 73;
        case 73:
          return [3 /*break*/, 75];
        case 74:
          if (e_5) throw e_5.error;
          return [7 /*endfinally*/];
        case 75:
          return [7 /*endfinally*/];
        case 76:
          if (!bulkOps.length) return [3 /*break*/, 78];
          return [4 /*yield*/, Article.bulkWrite(bulkOps)];
        case 77:
          res = _x.sent();
          console.log(
            "Phase 6 \u2014 normalized titles on ".concat(
              res.modifiedCount,
              " articles",
            ),
          );
          return [3 /*break*/, 79];
        case 78:
          console.log("Phase 6 — no odd titles found to normalize");
          _x.label = 79;
        case 79:
          console.log("🧹 Cleanup complete");
          if (!!alreadyConnected) return [3 /*break*/, 81];
          return [4 /*yield*/, mongoose_1.default.disconnect()];
        case 80:
          _x.sent();
          console.log("✅ MongoDB disconnected");
          _x.label = 81;
        case 81:
          return [2 /*return*/];
      }
    });
  });
}
exports.cleanupArticles = cleanupArticles;
/**
 * If invoked directly (`ts-node cleanup-articles.ts`), run immediately.
 */
if (require.main === module) {
  cleanupArticles().catch(function (err) {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });
}
