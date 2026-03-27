/**
 * Golden regression harness for POST /api/receipt/analyze JSON bodies.
 * Compares a stable "slice" (totals, currency, VAT, reward, duplicate, fraud, status).
 *
 * Usage:
 *   npx tsx tooling/receipt-analyze-regression.ts
 *   npx tsx tooling/receipt-analyze-regression.ts capture <response.json> [out-golden.json]
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  extractAnalyzeRegressionSlice,
  parseGoldenJson,
  regressionSliceDiff,
  regressionSliceToJson,
} from "../lib/receipt/regression/analyze-regression-slice";

const REGRESSION_DIR = path.join(process.cwd(), "regression", "receipt-analyze");
const CASES_DIR = path.join(REGRESSION_DIR, "cases");

function readJsonFile(filePath: string): unknown {
  const text = fs.readFileSync(filePath, "utf8");
  return JSON.parse(text) as unknown;
}

function printHelp(): void {
  console.log(`receipt-analyze-regression — golden slice compare for /api/receipt/analyze

Commands:
  (default)     Run all cases under regression/receipt-analyze/cases/* that have
                golden.json + actual.json
  capture <in>  Read a full API JSON (or { type: "done", ... } stream payload),
                print slice to stdout. Optional second arg: write golden file path

Folders:
  ${CASES_DIR}/<caseId>/golden.json   expected slice
  ${CASES_DIR}/<caseId>/actual.json   captured full response (commit locally or CI artifact)
`);
}

function runCapture(args: string[]): void {
  const inputPath = args[1];
  const outPath = args[2];
  if (!inputPath) {
    console.error("capture: missing <response.json>");
    process.exit(1);
  }
  const abs = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
  const raw = readJsonFile(abs);
  const slice = extractAnalyzeRegressionSlice(raw);
  const text = regressionSliceToJson(slice);
  if (outPath) {
    const outAbs = path.isAbsolute(outPath) ? outPath : path.join(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, text, "utf8");
    console.error(`Wrote ${outAbs}`);
  } else {
    process.stdout.write(text);
  }
}

function listCaseDirs(): string[] {
  if (!fs.existsSync(CASES_DIR)) return [];
  return fs
    .readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function runAll(): number {
  const dirs = listCaseDirs();
  if (dirs.length === 0) {
    console.error(`No cases under ${CASES_DIR}`);
    return 1;
  }
  let failures = 0;
  let ran = 0;
  for (const name of dirs) {
    const base = path.join(CASES_DIR, name);
    const goldenPath = path.join(base, "golden.json");
    const actualPath = path.join(base, "actual.json");
    if (!fs.existsSync(goldenPath)) {
      console.warn(`[skip] ${name}: missing golden.json`);
      continue;
    }
    if (!fs.existsSync(actualPath)) {
      console.warn(`[skip] ${name}: missing actual.json (add a captured response to compare)`);
      continue;
    }
    ran++;
    const goldenText = fs.readFileSync(goldenPath, "utf8");
    const expected = parseGoldenJson(goldenText);
    const actualRaw = readJsonFile(actualPath);
    const got = extractAnalyzeRegressionSlice(actualRaw);
    const diff = regressionSliceDiff(expected, got);
    if (diff) {
      failures++;
      console.error(`\nFAIL  ${name}\n${diff}\n`);
    } else {
      console.log(`OK    ${name}`);
    }
  }
  if (ran === 0) {
    console.error("No case had both golden.json and actual.json.");
    return 1;
  }
  if (failures > 0) {
    console.error(`\n${failures} case(s) failed.`);
    return 1;
  }
  console.error(`\nAll ${ran} case(s) passed.`);
  return 0;
}

const argv = process.argv.slice(2);
if (argv.includes("-h") || argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

if (argv[0] === "capture") {
  runCapture(argv);
  process.exit(0);
}

process.exit(runAll());
