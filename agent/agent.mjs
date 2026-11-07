#!/usr/bin/env node
// IOIT Print Anywhere — Windows print agent.
// Polls the server for paid orders, prints the cover sheet + document with SumatraPDF
// (A4, black & white, page range, copies), waits for the Windows print queue to finish,
// then reports the order as ready. No dependencies; needs Node.js 20+.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrintSettings } from "./printSettings.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = process.env.PA_AGENT_CONFIG ?? path.join(here, "agent.config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));

const cfg = {
  serverUrl: String(config.serverUrl ?? "").replace(/\/+$/, ""),
  apiKey: String(config.apiKey ?? ""),
  agentId: String(config.agentId ?? os.hostname()).slice(0, 64),
  printerName: String(config.printerName ?? ""),
  sumatraPath: String(config.sumatraPath ?? "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe"),
  pollSeconds: Number(config.pollSeconds ?? 5),
  heartbeatSeconds: Number(config.heartbeatSeconds ?? 10),
  queueTimeoutMinutes: Number(config.queueTimeoutMinutes ?? 120),
  tempDir: String(config.tempDir ?? path.join(os.tmpdir(), "ioit-print-anywhere")),
  // Dry run logs the print commands instead of printing. Always on outside Windows.
  dryRun: Boolean(config.dryRun) || process.platform !== "win32",
};

if (!cfg.serverUrl || !cfg.apiKey) throw new Error("serverUrl and apiKey are required in agent.config.json");
if (!cfg.dryRun && !cfg.printerName) throw new Error("printerName is required in agent.config.json");

let currentOrderId = null;
let printerStatus = cfg.dryRun ? "dry run" : "starting";
let stopping = false;

const log = (...args) => console.log(new Date().toISOString(), ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- server API

async function api(method, pathname, body) {
  const res = await fetch(cfg.serverUrl + pathname, {
    method,
    headers: { authorization: `Bearer ${cfg.apiKey}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 401) throw new Error("Server rejected the API key (401). Check apiKey in agent.config.json.");
  return res;
}

async function heartbeat() {
  try {
    if (!cfg.dryRun && !currentOrderId) printerStatus = await readPrinterStatus();
    await api("POST", "/api/agent/heartbeat", { agentId: cfg.agentId, printerStatus, currentOrderId });
  } catch (err) {
    log("heartbeat failed:", err.message);
  }
}

async function claimJob() {
  const res = await api("POST", "/api/agent/claim", { agentId: cfg.agentId });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`claim failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function download(urlPath, dest) {
  const res = await api("GET", urlPath);
  if (!res.ok) throw new Error(`download ${urlPath} failed: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.subarray(0, 1024).toString("latin1").includes("%PDF-")) throw new Error(`download ${urlPath} is not a PDF`);
  await writeFile(dest, bytes);
}

// ---------------------------------------------------------------- Windows printing

function powershell(script, env = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { env: { ...process.env, ...env }, timeout: 30_000, windowsHide: true },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout.trim())),
    );
  });
}

// The printer name is passed through an environment variable, never spliced into the script.
async function readPrinterStatus() {
  try {
    const out = await powershell("(Get-Printer -Name $env:PA_PRINTER).PrinterStatus", { PA_PRINTER: cfg.printerName });
    return out ? `printer: ${out}` : "printer: unknown";
  } catch {
    return "printer not found";
  }
}

async function listQueuedJobs() {
  const out = await powershell(
    "Get-PrintJob -PrinterName $env:PA_PRINTER | Select-Object DocumentName, JobStatus | ConvertTo-Json -Compress",
    { PA_PRINTER: cfg.printerName },
  );
  if (!out) return [];
  const parsed = JSON.parse(out);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((j) => ({
    name: String(j.DocumentName ?? ""),
    status: String(j.JobStatus ?? ""),
  }));
}

function runSumatra(file, settings) {
  const args = ["-print-to", cfg.printerName || "<printer>", "-print-settings", settings, "-silent", file];
  if (cfg.dryRun) {
    log("[dry run]", cfg.sumatraPath, args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" "));
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const child = spawn(cfg.sumatraPath, args, { windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("SumatraPDF timed out while sending the job"));
    }, 5 * 60_000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`could not start SumatraPDF at ${cfg.sumatraPath}: ${err.message}`));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`SumatraPDF exited with code ${code}`));
    });
  });
}

/** Waits until every queued job whose name contains `tag` has left the Windows print queue. */
async function waitForQueueToClear(tag) {
  if (cfg.dryRun) return;
  const started = Date.now();
  let seen = false;
  while (true) {
    const mine = (await listQueuedJobs()).filter((j) => j.name.includes(tag));
    if (mine.length === 0) {
      // Fast printers may finish before we ever see the job; after ~15s with nothing queued, we're done.
      if (seen || Date.now() - started > 15_000) return;
    } else {
      seen = true;
      const problem = mine.find((j) => /error|paper|offline|paused|blocked|attention/i.test(j.status));
      printerStatus = problem ? `attention: ${problem.status}` : `printing ${tag}`;
    }
    if (Date.now() - started > cfg.queueTimeoutMinutes * 60_000) {
      throw new Error(`job still in the print queue after ${cfg.queueTimeoutMinutes} minutes`);
    }
    await sleep(3000);
  }
}

// ---------------------------------------------------------------- job processing

async function processJob(job) {
  const tag = `PA-${String(job.printingCode).replace(/[^A-Z0-9-]/gi, "")}`;
  const dir = path.join(cfg.tempDir, job.orderId.replace(/[^a-z0-9]/gi, ""));
  const coverFile = path.join(dir, `${tag}-cover.pdf`);
  const docFile = path.join(dir, `${tag}-document.pdf`);

  currentOrderId = job.orderId;
  log(`printing ${job.printingCode}: "${job.fileName}" pages=${job.pageRange} (${job.selectedPages}) copies=${job.copies}`);
  try {
    await mkdir(dir, { recursive: true });
    await download(job.coverUrl, coverFile);
    await download(job.documentUrl, docFile);

    // Cover sheet first (once), then the document.
    await runSumatra(coverFile, buildPrintSettings("all", 1));
    await runSumatra(docFile, buildPrintSettings(job.pageRange, job.copies));
    await waitForQueueToClear(tag);

    const res = await api("POST", `/api/agent/jobs/${job.orderId}/complete`);
    if (!res.ok) log(`complete for ${job.printingCode} returned ${res.status}`);
    else log(`done ${job.printingCode} — student notified`);
  } catch (err) {
    log(`FAILED ${job.printingCode}:`, err.message);
    await api("POST", `/api/agent/jobs/${job.orderId}/fail`, { reason: err.message }).catch((e) =>
      log("could not report failure:", e.message),
    );
  } finally {
    currentOrderId = null;
    printerStatus = cfg.dryRun ? "dry run" : await readPrinterStatus();
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  log(`IOIT Print Anywhere agent "${cfg.agentId}" → ${cfg.serverUrl}${cfg.dryRun ? " (DRY RUN — nothing will print)" : ` printer "${cfg.printerName}"`}`);
  await heartbeat();
  const hb = setInterval(heartbeat, cfg.heartbeatSeconds * 1000);

  while (!stopping) {
    try {
      const job = await claimJob();
      if (job) {
        await processJob(job);
        continue; // check for the next job straight away
      }
    } catch (err) {
      log("poll error:", err.message);
    }
    await sleep(cfg.pollSeconds * 1000);
  }
  clearInterval(hb);
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    log(`received ${sig}, finishing current job then exiting`);
    stopping = true;
    if (!currentOrderId) process.exit(0);
  });
}

await main();
