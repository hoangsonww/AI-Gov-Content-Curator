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
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlArticlesFromHomepage =
  exports.fetchStaticArticle =
  exports.fetchDynamicArticle =
    void 0;
var puppeteer_core_1 = require("puppeteer-core");
var chromium = require("@sparticuz/chromium");
var axios_1 = require("axios");
var cheerio = require("cheerio");
var url_1 = require("url");
var RETRY_DELAY_MS = 2000;
var AXIOS_TIMEOUT_MS = 10000; // Abort axios requests after 10 seconds
/**
 * Delay function to pause execution for a specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to wait.
 */
var delay = function (ms) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, ms);
  });
};
/**
 * Derive a title from the raw title or the body of the article.
 *
 * @param rawTitle - The raw title of the article.
 * @param content - The body content of the article.
 */
var deriveTitle = function (rawTitle, content) {
  var title = rawTitle.trim();
  if (title) return title;
  var firstSentenceMatch = content.match(/(.{1,120}?[.!?])\s/);
  if (firstSentenceMatch) return firstSentenceMatch[1].trim();
  var firstWords = content.split(/\s+/).slice(0, 10).join(" ").trim();
  return firstWords || "Untitled";
};
/**
 * Fetch a dynamic article using Puppeteer.
 *
 * @param url - The URL of the article to fetch.
 */
var fetchDynamicArticle = function (url) {
  return __awaiter(void 0, void 0, void 0, function () {
    var executablePath, browser, page, _a, err_1, html, $, content, title;
    return __generator(this, function (_b) {
      switch (_b.label) {
        case 0:
          return [4 /*yield*/, chromium.executablePath()];
        case 1:
          executablePath = _b.sent();
          return [
            4 /*yield*/,
            puppeteer_core_1.default.launch({
              executablePath: executablePath,
              headless: chromium.headless,
              args: chromium.args,
            }),
          ];
        case 2:
          browser = _b.sent();
          return [4 /*yield*/, browser.newPage()];
        case 3:
          page = _b.sent();
          return [
            4 /*yield*/,
            page.setUserAgent(
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
            ),
          ];
        case 4:
          _b.sent();
          _b.label = 5;
        case 5:
          _b.trys.push([5, 7, , 13]);
          return [
            4 /*yield*/,
            page.goto(url, { waitUntil: "networkidle2", timeout: 15000 }),
          ];
        case 6:
          _b.sent();
          return [3 /*break*/, 13];
        case 7:
          _a = _b.sent();
          console.warn(
            "networkidle2 timed out for ".concat(
              url,
              ", falling back to domcontentloaded...",
            ),
          );
          _b.label = 8;
        case 8:
          _b.trys.push([8, 10, , 12]);
          return [
            4 /*yield*/,
            page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }),
          ];
        case 9:
          _b.sent();
          return [3 /*break*/, 12];
        case 10:
          err_1 = _b.sent();
          return [4 /*yield*/, browser.close()];
        case 11:
          _b.sent();
          throw err_1;
        case 12:
          return [3 /*break*/, 13];
        case 13:
          return [4 /*yield*/, page.content()];
        case 14:
          html = _b.sent();
          return [4 /*yield*/, browser.close()];
        case 15:
          _b.sent();
          $ = cheerio.load(html);
          // Remove unwanted elements before extracting text
          $("script, style, iframe, noscript").remove();
          $('head [type="application/ld+json"]').remove();
          content = $("body").text().replace(/\s+/g, " ").trim() || "";
          title = deriveTitle($("title").text(), content);
          return [
            2 /*return*/,
            { url: url, title: title, content: content, source: url },
          ];
      }
    });
  });
};
exports.fetchDynamicArticle = fetchDynamicArticle;
/**
 * Regular expression to match static file extensions.
 *
 * @param url - The URL to check.
 * @param retries - The number of retries left.
 */
var fetchStaticArticle = function (url, retries) {
  if (retries === void 0) {
    retries = 3;
  }
  return __awaiter(void 0, void 0, void 0, function () {
    var data, $, content, title, err_2;
    var _a;
    return __generator(this, function (_b) {
      switch (_b.label) {
        case 0:
          _b.trys.push([0, 2, , 5]);
          return [
            4 /*yield*/,
            axios_1.default.get(url, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                  "(KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              },
              timeout: AXIOS_TIMEOUT_MS,
            }),
          ];
        case 1:
          data = _b.sent().data;
          $ = cheerio.load(data);
          // Remove unwanted elements before extracting text
          $("script, style, iframe, noscript").remove();
          $('head [type="application/ld+json"]').remove();
          content = $("body").text().replace(/\s+/g, " ").trim() || "";
          title = deriveTitle($("title").text(), content);
          return [
            2 /*return*/,
            { url: url, title: title, content: content, source: url },
          ];
        case 2:
          err_2 = _b.sent();
          if (
            !(
              retries > 0 &&
              (err_2.code === "ECONNRESET" || err_2.code === "ECONNABORTED")
            )
          )
            return [3 /*break*/, 4];
          console.warn(
            "Error ("
              .concat(err_2.code, ") fetching ")
              .concat(url, ", retrying in ")
              .concat(RETRY_DELAY_MS, "ms..."),
          );
          return [4 /*yield*/, delay(RETRY_DELAY_MS)];
        case 3:
          _b.sent();
          return [
            2 /*return*/,
            (0, exports.fetchStaticArticle)(url, retries - 1),
          ];
        case 4:
          // On 403, fall back to dynamic
          if (
            axios_1.default.isAxiosError(err_2) &&
            ((_a = err_2.response) === null || _a === void 0
              ? void 0
              : _a.status) === 403
          ) {
            console.warn(
              "Static fetch 403 for ".concat(
                url,
                ", falling back to dynamic...",
              ),
            );
            return [2 /*return*/, (0, exports.fetchDynamicArticle)(url)];
          }
          throw err_2;
        case 5:
          return [2 /*return*/];
      }
    });
  });
};
exports.fetchStaticArticle = fetchStaticArticle;
/**
 * Crawl a list of homepage URLs to find article links.
 *
 * @param homepageUrls - The homepage URLs to crawl.
 * @param maxLinks - The maximum number of links to collect.
 * @param maxDepth - The maximum depth to crawl.
 * @param concurrency - The number of concurrent requests.
 */
var crawlArticlesFromHomepage = function (
  homepageUrls,
  maxLinks,
  maxDepth,
  concurrency,
) {
  if (maxLinks === void 0) {
    maxLinks = 20;
  }
  if (maxDepth === void 0) {
    maxDepth = 1;
  }
  if (concurrency === void 0) {
    concurrency = 5;
  }
  return __awaiter(void 0, void 0, void 0, function () {
    var seeds, queue, visited, collected, worker;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          seeds = Array.isArray(homepageUrls) ? homepageUrls : [homepageUrls];
          queue = seeds.map(function (u) {
            return {
              url: u,
              depth: 0,
              domain: new url_1.URL(u).hostname,
            };
          });
          visited = new Set();
          collected = new Set();
          worker = function () {
            return __awaiter(void 0, void 0, void 0, function () {
              var _loop_1, state_1;
              return __generator(this, function (_a) {
                switch (_a.label) {
                  case 0:
                    _loop_1 = function () {
                      var item,
                        url,
                        depth,
                        domain,
                        html,
                        resp,
                        _b,
                        $,
                        linksOnPage,
                        _i,
                        linksOnPage_1,
                        link,
                        _c,
                        linksOnPage_2,
                        link;
                      return __generator(this, function (_d) {
                        switch (_d.label) {
                          case 0:
                            item = queue.shift();
                            if (!item) return [2 /*return*/, "break"];
                            (url = item.url),
                              (depth = item.depth),
                              (domain = item.domain);
                            if (visited.has(url))
                              return [2 /*return*/, "continue"];
                            visited.add(url);
                            html = void 0;
                            _d.label = 1;
                          case 1:
                            _d.trys.push([1, 3, , 4]);
                            return [
                              4 /*yield*/,
                              axios_1.default.get(url, {
                                headers: {
                                  "User-Agent":
                                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 " +
                                    "Safari/537.36",
                                  Accept:
                                    "text/html,application/xhtml+xml,application/xml;" +
                                    "q=0.9,image/webp,*/*;q=0.8",
                                },
                                timeout: AXIOS_TIMEOUT_MS,
                              }),
                            ];
                          case 2:
                            resp = _d.sent();
                            html = resp.data;
                            return [3 /*break*/, 4];
                          case 3:
                            _b = _d.sent();
                            return [2 /*return*/, "continue"];
                          case 4:
                            $ = cheerio.load(html);
                            linksOnPage = [];
                            $("a[href]").each(function (_, el) {
                              var href = $(el).attr("href");
                              if (!href) return;
                              try {
                                var abs = new url_1.URL(href, url).href;
                                if (new url_1.URL(abs).hostname === domain) {
                                  linksOnPage.push(abs);
                                }
                              } catch (_a) {
                                /* ignore malformed URLs */
                              }
                            });
                            // Collect up to maxLinks
                            for (
                              _i = 0, linksOnPage_1 = linksOnPage;
                              _i < linksOnPage_1.length;
                              _i++
                            ) {
                              link = linksOnPage_1[_i];
                              if (collected.size >= maxLinks) break;
                              if (!collected.has(link) && link !== url) {
                                collected.add(link);
                              }
                            }
                            // Enqueue next-depth
                            if (depth + 1 < maxDepth) {
                              for (
                                _c = 0, linksOnPage_2 = linksOnPage;
                                _c < linksOnPage_2.length;
                                _c++
                              ) {
                                link = linksOnPage_2[_c];
                                if (!visited.has(link)) {
                                  queue.push({
                                    url: link,
                                    depth: depth + 1,
                                    domain: domain,
                                  });
                                }
                              }
                            }
                            return [2 /*return*/];
                        }
                      });
                    };
                    _a.label = 1;
                  case 1:
                    if (!(collected.size < maxLinks)) return [3 /*break*/, 3];
                    return [5 /*yield**/, _loop_1()];
                  case 2:
                    state_1 = _a.sent();
                    if (state_1 === "break") return [3 /*break*/, 3];
                    return [3 /*break*/, 1];
                  case 3:
                    return [2 /*return*/];
                }
              });
            });
          };
          // Launch workers that naturally dovetail across all seeded homepages
          return [
            4 /*yield*/,
            Promise.all(
              Array.from({ length: concurrency }, function () {
                return worker();
              }),
            ),
          ];
        case 1:
          // Launch workers that naturally dovetail across all seeded homepages
          _a.sent();
          return [2 /*return*/, Array.from(collected).slice(0, maxLinks)];
      }
    });
  });
};
exports.crawlArticlesFromHomepage = crawlArticlesFromHomepage;
