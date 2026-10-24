require("dotenv").config();
const express = require("express");
const Parser = require("rss-parser");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const app = express();
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const CHECK_CRON = process.env.CHECK_CRON || "*/5 * * * *";
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "NandanDigitalSevaKendra/1.0 RSS reader" },
  customFields: { item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"]] }
});

// Support BOTH layouts: files inside /automation OR flattened in the project root.
function firstExisting(paths) {
  return paths.find(p => fs.existsSync(p));
}
const monitorPath = firstExisting([
  path.join(ROOT, "automation", "bpsc-monitor.js"),
  path.join(ROOT, "bpsc-monitor.js")
]);
if (!monitorPath) {
  console.error("Missing bpsc-monitor.js. Keep it beside server-updated.js or inside automation/.");
  process.exit(1);
}
const { checkBpsc } = require(monitorPath);

const nestedDataExists = fs.existsSync(path.join(ROOT, "automation", "sources.json")) ||
  fs.existsSync(path.join(ROOT, "automation", "posts.json"));
const defaultDataDir = nestedDataExists ? path.join(ROOT, "automation") : ROOT;
const DATA_DIR = process.env.DATA_DIR || defaultDataDir;
fs.mkdirSync(DATA_DIR, { recursive: true });
const SOURCES = path.join(DATA_DIR, "sources.json");
const POSTS = path.join(DATA_DIR, "posts.json");
const SEEN = path.join(DATA_DIR, "bpsc-seen.json");

function seedIfMissing(target, candidates, fallback) {
  if (fs.existsSync(target)) return;
  const source = firstExisting(candidates);
  try {
    if (source) fs.copyFileSync(source, target);
    else fs.writeFileSync(target, JSON.stringify(fallback, null, 2) + "\n", "utf8");
  } catch (error) {
    console.error(`Could not seed ${path.basename(target)}: ${error.message}`);
  }
}
seedIfMissing(SOURCES, [path.join(ROOT, "automation", "sources.json"), path.join(ROOT, "sources.json")], []);
seedIfMissing(POSTS, [path.join(ROOT, "automation", "posts.json"), path.join(ROOT, "posts.json")], []);
seedIfMissing(SEEN, [path.join(ROOT, "automation", "bpsc-seen.json"), path.join(ROOT, "bpsc-seen.json")], []);

app.use(express.json({ limit: "100kb" }));
app.use(express.static(ROOT));
if (fs.existsSync(path.join(ROOT, "public"))) app.use(express.static(path.join(ROOT, "public")));

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
function write(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8"); }
function clean(value, max = 300) { return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
function isHttpUrl(value) {
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
}
function admin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: "Admin access is not configured. Set ADMIN_TOKEN in hosting environment variables." });
  if (req.get("x-admin-token") !== ADMIN_TOKEN) return res.status(401).json({ error: "Admin token गलत है।" });
  next();
}

app.get("/api/health", (_req, res) => res.json({ ok: true, schedule: CHECK_CRON }));
app.get("/api/sources", (_req, res) => res.json(read(SOURCES, []).map(({ id, name, url, enabled, category, rssUrl }) => ({ id, name, url, enabled, category, configured: !!rssUrl }))));
app.get("/api/posts", (_req, res) => { res.set("Cache-Control", "no-store"); res.json(read(POSTS, []).slice(0, 500)); });
app.put("/api/admin/sources/:id", admin, (req, res) => {
  const list = read(SOURCES, []);
  const source = list.find(item => item.id === req.params.id);
  if (!source) return res.status(404).json({ error: "Source नहीं मिला" });
  const { rssUrl, enabled } = req.body || {};
  if (rssUrl !== undefined && rssUrl !== "" && !isHttpUrl(rssUrl)) return res.status(400).json({ error: "वैध http/https RSS URL दें" });
  if (rssUrl !== undefined && rssUrl !== "") source.rssUrl = rssUrl;
  if (enabled !== undefined) source.enabled = !!enabled;
  if (source.enabled && !source.rssUrl) return res.status(400).json({ error: "पहले सत्यापित RSS URL जोड़ें" });
  write(SOURCES, list);
  res.json({ ok: true, id: source.id, enabled: source.enabled, configured: !!source.rssUrl });
});

async function checkFeeds() {
  const sources = read(SOURCES, []);
  const posts = read(POSTS, []);
  const known = new Set(posts.map(post => post.guid));
  let added = 0;
  for (const source of sources.filter(item => item.enabled && item.rssUrl)) {
    try {
      const feed = await parser.parseURL(source.rssUrl);
      for (const item of (feed.items || []).slice(0, 40).reverse()) {
        const link = item.link || "";
        const guid = clean(item.guid || link || `${source.id}:${item.title}`, 700);
        const title = clean(item.title, 240);
        if (!title || !isHttpUrl(link) || known.has(guid)) continue;
        const enclosure = item.enclosure || {};
        const thumbnail = item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url;
        const imageUrl = thumbnail || (enclosure.url && /^image\//i.test(enclosure.type || "") ? enclosure.url : "");
        posts.unshift({
          guid, title,
          summary: clean(item.contentSnippet || item.summary || "", 280),
          sourceId: source.id, sourceName: source.name, category: source.category,
          url: link, imageUrl,
          mediaUrl: enclosure.url && /^video\//i.test(enclosure.type || "") ? enclosure.url : "",
          mediaType: enclosure.type || "",
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          importedAt: new Date().toISOString()
        });
        known.add(guid); added++;
      }
    } catch (error) { console.error(`[feed error] ${source.name}: ${error.message}`); }
  }
  try {
    const notices = await checkBpsc();
    for (const item of notices) {
      const guid = item.url;
      if (!item.title || !isHttpUrl(item.url) || known.has(guid)) continue;
      posts.unshift({ guid, title: clean(item.title, 240), summary: "Official BPSC notice. Open the official link for full details.", sourceId: "bpsc", sourceName: "BPSC", category: "Government Jobs / Notices", url: item.url, publishedAt: new Date().toISOString(), importedAt: new Date().toISOString() });
      known.add(guid); added++;
    }
  } catch (error) { console.error(`[BPSC monitor error] ${error.message}`); }
  if (added) write(POSTS, posts.slice(0, 500));
  console.log(`${new Date().toISOString()} Automatic check: ${added} new post(s)`);
  return added;
}
app.post("/api/admin/check-now", admin, async (_req, res) => {
  try { res.json({ ok: true, added: await checkFeeds() }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});
app.get("/admin", (_req, res) => {
  const adminPage = firstExisting([path.join(ROOT, "automation-admin.html"), path.join(ROOT, "public", "automation-admin.html")]);
  if (!adminPage) return res.status(404).send("Admin page not found.");
  res.sendFile(adminPage);
});

app.listen(PORT, () => {
  console.log(`NANDAN DIGITAL SEVA KENDRA server listening on port ${PORT}`);
  console.log(`Health check: /api/health`);
  if (!ADMIN_TOKEN) console.warn("Set ADMIN_TOKEN in hosting environment variables before using admin routes.");
  cron.schedule(CHECK_CRON, () => checkFeeds().catch(console.error));
  checkFeeds().catch(console.error);
});
