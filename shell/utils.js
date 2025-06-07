#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

// Base dirs are siblings of shell/
const SERVICES = ["frontend", "backend", "crawler", "newsletters"];
const BASE_DIR = path.resolve(__dirname, "..");

function runMake(target) {
  const result = spawnSync("make", [target], {
    cwd: BASE_DIR,
    stdio: "inherit",
    shell: true,
  });
  process.exit(result.status);
}

yargs(hideBin(process.argv))
  .usage("Usage: $0 <command> [service]")
  .command(
    "dev [service]",
    "Run dev mode",
    (y) => {
      y.positional("service", {
        describe: 'Which service (or "all")',
        type: "string",
        default: "all",
      });
    },
    (argv) => {
      if (argv.service === "all") {
        runMake("dev");
      } else if (SERVICES.includes(argv.service)) {
        runMake(`dev-${argv.service}`);
      } else {
        console.error(`Unknown service: ${argv.service}`);
        process.exit(1);
      }
    },
  )
  .command(
    "build [service]",
    "Build for production",
    (y) => {
      y.positional("service", {
        describe: 'Which service (or "all")',
        type: "string",
        default: "all",
      });
    },
    (argv) => {
      if (argv.service === "all") {
        runMake("build");
      } else if (SERVICES.includes(argv.service)) {
        runMake(`build-${argv.service}`);
      } else {
        console.error(`Unknown service: ${argv.service}`);
        process.exit(1);
      }
    },
  )
  .command(
    "start [service]",
    "Start in production mode",
    (y) => {
      y.positional("service", {
        describe: 'Which service (or "all")',
        type: "string",
        default: "all",
      });
    },
    (argv) => {
      if (argv.service === "all") {
        runMake("start");
      } else if (SERVICES.includes(argv.service)) {
        runMake(`start-${argv.service}`);
      } else {
        console.error(`Unknown service: ${argv.service}`);
        process.exit(1);
      }
    },
  )
  .command(
    "test [service]",
    "Run tests",
    (y) => {
      y.positional("service", {
        describe: 'Which service (or "all")',
        type: "string",
        default: "all",
      });
    },
    (argv) => {
      if (argv.service === "all") {
        runMake("test");
      } else if (SERVICES.includes(argv.service)) {
        runMake(`test-${argv.service}`);
      } else {
        console.error(`Unknown service: ${argv.service}`);
        process.exit(1);
      }
    },
  )
  .command(
    "lint [service]",
    "Run linter",
    (y) => {
      y.positional("service", {
        describe: 'Which service (or "all")',
        type: "string",
        default: "all",
      });
    },
    (argv) => {
      if (argv.service === "all") {
        runMake("lint");
      } else if (SERVICES.includes(argv.service)) {
        runMake(`lint-${argv.service}`);
      } else {
        console.error(`Unknown service: ${argv.service}`);
        process.exit(1);
      }
    },
  )
  .command(
    "typecheck [service]",
    "Run type checks",
    (y) => {
      y.positional("service", {
        describe: 'Which service (or "all")',
        type: "string",
        default: "all",
      });
    },
    (argv) => {
      if (argv.service === "all") {
        runMake("typecheck");
      } else if (SERVICES.includes(argv.service)) {
        runMake(`typecheck-${argv.service}`);
      } else {
        console.error(`Unknown service: ${argv.service}`);
        process.exit(1);
      }
    },
  )
  .demandCommand(1, "Specify a command to run")
  .help().argv;
