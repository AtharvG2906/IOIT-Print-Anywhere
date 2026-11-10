// One-time setup: lets the app save college ID cards into the admin's Google Drive folder.
//
//   1. Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (a "Desktop app" OAuth client) in .env
//   2. npm run drive:setup
//   3. Sign in with the Google account that OWNS the folder and click Allow
//
// It checks the app can add files to GOOGLE_DRIVE_FOLDER_ID and saves GOOGLE_REFRESH_TOKEN into .env.
// Secrets are never printed.
import "dotenv/config";
import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";

const DEFAULT_FOLDER = "1s3G0b99haZO_heaIEHkjcmzNwrydhPCM";
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER;

if (!clientId || !clientSecret) {
  console.error("✗ Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env first (see README → Google Drive).");
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}/callback`;
const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // Full Drive scope: needed to add files to a folder the app didn't create. The app only uses this one folder.
    scope: "https://www.googleapis.com/auth/drive",
    access_type: "offline",
    prompt: "consent",
  });

function saveEnv(values) {
  let text = readFileSync(".env", "utf8");
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}="${v}"`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(".env", text);
}

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, redirectUri);
    if (url.pathname !== "/callback") return res.end();
    const c = url.searchParams.get("code");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(c ? "<h2>✅ Done — you can close this tab and go back to the terminal.</h2>" : "<h2>Sign-in was cancelled.</h2>");
    server.close();
    if (c) resolve(c);
    else reject(new Error(url.searchParams.get("error") ?? "cancelled"));
  });
  server.listen(PORT, "127.0.0.1", () => {
    console.log("\nOpening Google sign-in in your browser…");
    console.log("Sign in with the account that owns the Drive folder, then click Allow.");
    console.log('If you see "Google hasn\'t verified this app": click Advanced → Go to … (unsafe). It\'s your own app.\n');
    console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);
    execFile("open", [authUrl], () => {});
  });
});

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
});
const tokens = await tokenRes.json();
if (!tokens.refresh_token) {
  console.error(`✗ Google didn't return a refresh token (${tokens.error ?? tokenRes.status}). Run the command again.`);
  process.exit(1);
}

const folderRes = await fetch(
  `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name,capabilities(canAddChildren)&supportsAllDrives=true`,
  { headers: { Authorization: `Bearer ${tokens.access_token}` } },
);
const folder = await folderRes.json();
if (!folderRes.ok) {
  console.error(`✗ Can't open the Drive folder (${folderRes.status}). Did you sign in with the account that owns it?`);
  process.exit(1);
}
if (!folder.capabilities?.canAddChildren) {
  console.error(`✗ This account can't add files to "${folder.name}". Sign in with the folder's owner (or an editor).`);
  process.exit(1);
}

saveEnv({ GOOGLE_REFRESH_TOKEN: tokens.refresh_token, GOOGLE_DRIVE_FOLDER_ID: folderId });
console.log(`✅ Connected to Drive folder "${folder.name}".`);
console.log("   Saved GOOGLE_REFRESH_TOKEN and GOOGLE_DRIVE_FOLDER_ID into .env (not shown here).");
console.log("   For the live site, copy these 4 from .env into Vercel → Settings → Environment Variables:");
console.log("   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID — then redeploy.");
