#!/usr/bin/env node

/**
 * @file CLI for AI-Article-Content-Curator monorepo
 * @fileOverview This script provides a command-line interface to manage the monorepo, including running services, managing articles, and more.
 * @description This script provides a command-line interface to manage the monorepo, including running services, managing articles, and more.
 * @module aicc
 * @author David Nguyen
 * @license MIT
 * @version 1.0.0
 */

const { spawn } = require("child_process");
const { Command } = require("commander");
const axios = require("axios");
const path = require("path");
const pkg = require("../package.json");

const services = ["frontend", "backend", "crawler"];
const scriptMap = {
  dev: (svc) => (svc ? `dev:${svc}` : null),
  build: (svc) => (svc ? `build:${svc}` : null),
  start: (svc) => (svc ? `start:${svc}` : null),
  lint: () => "lint",
  format: () => "format",
};

const api = axios.create({
  baseURL: process.env.AICC_API_URL || "http://localhost:3000/api",
  timeout: 5000,
  headers: { "Content-Type": "application/json" },
});

function run(script, opts = {}) {
  const proc = spawn("npm", ["run", script], {
    stdio: "inherit",
    shell: true,
    ...opts,
  });
  proc.on("exit", (code) => process.exit(code));
}

const program = new Command();
program
  .name("aicc")
  .description("AI-Article-Content-Curator monorepo CLI")
  .version(pkg.version);

// ==== service commands ====
["dev", "build", "start"].forEach((cmd) => {
  program
    .command(`${cmd} [service]`)
    .description(`${cmd} service(s)`)
    .action((service) => {
      if (service && !services.includes(service)) {
        console.error(`Unknown service: ${service}`);
        process.exit(1);
      }
      if (service) {
        run(scriptMap[cmd](service));
      } else {
        // run all in parallel
        services.forEach((s) => {
          spawn("npm", ["run", scriptMap[cmd](s)], {
            stdio: "inherit",
            shell: true,
          });
        });
      }
    });
});

program
  .command("lint")
  .description("Run prettier on everything")
  .action(() => run(scriptMap.lint()));

program
  .command("format")
  .description("Alias for lint")
  .action(() => run(scriptMap.format()));

// ==== crawl command ====
program
  .command("crawl")
  .description("Run the crawler (schedule/fetchAndSummarize.ts)")
  .action(() => {
    const crawlerDir = path.resolve(__dirname, "../crawler");
    console.log("▶️  Running crawler in:", crawlerDir);
    run("crawl", { cwd: crawlerDir });
  });

// ==== article CRUD commands ====
const article = program.command("article").description("Manage articles");

// create
article
  .command("create")
  .description("Create a new article")
  .requiredOption("--title <title>", "Article title")
  .requiredOption(
    "--content <content>",
    "Article content (will be saved to `content` field)",
  )
  .option("--summary <summary>", "Article summary")
  .option("--topics <topics...>", "List of topics")
  .option("--source <source>", "Source identifier")
  .action(async (opts) => {
    try {
      const payload = {
        title: opts.title,
        content: opts.content,
        summary: opts.summary,
        topics: opts.topics || [],
        source: opts.source || "",
      };
      const res = await api.post("/articles", payload);
      console.log("✅ Created article:", res.data);
    } catch (err) {
      console.error(
        "❌ Error creating article:",
        err.response?.data || err.message,
      );
      process.exit(1);
    }
  });

// read / get
article
  .command("get <id>")
  .description("Fetch an article by ID")
  .action(async (id) => {
    try {
      const res = await api.get(`/articles/${id}`);
      console.log("📄 Article:", res.data);
    } catch (err) {
      console.error(
        "❌ Error fetching article:",
        err.response?.data || err.message,
      );
      process.exit(1);
    }
  });

// list
article
  .command("list")
  .description("List all articles")
  .option("--limit <n>", "Limit number of results", parseInt)
  .action(async (opts) => {
    try {
      const res = await api.get("/articles", { params: { limit: opts.limit } });
      console.log("📑 Articles list:", res.data);
    } catch (err) {
      console.error(
        "❌ Error listing articles:",
        err.response?.data || err.message,
      );
      process.exit(1);
    }
  });

// update
article
  .command("update <id>")
  .description("Update an existing article")
  .option("--title <title>", "New title")
  .option("--content <content>", "New content")
  .option("--summary <summary>", "New summary")
  .option("--topics <topics...>", "New list of topics")
  .option("--source <source>", "New source")
  .action(async (id, opts) => {
    try {
      const payload = {};
      ["title", "content", "summary", "source"].forEach((key) => {
        if (opts[key] !== undefined) payload[key] = opts[key];
      });
      if (opts.topics) payload.topics = opts.topics;
      const res = await api.put(`/articles/${id}`, payload);
      console.log("✅ Updated article:", res.data);
    } catch (err) {
      console.error(
        "❌ Error updating article:",
        err.response?.data || err.message,
      );
      process.exit(1);
    }
  });

// delete
article
  .command("delete <id>")
  .description("Delete an article by ID")
  .action(async (id) => {
    try {
      await api.delete(`/articles/${id}`);
      console.log(`🗑️  Deleted article ${id}`);
    } catch (err) {
      console.error(
        "❌ Error deleting article:",
        err.response?.data || err.message,
      );
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command given
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
