const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const PAGE = "https://bpsc.bihar.gov.in/whats-new/";
const DATA_DIR = process.env.DATA_DIR || __dirname;
const SEEN_FILE = path.join(DATA_DIR, "bpsc-seen.json");

function readSeen() {
  try {
    return JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2), "utf8");
}

async function checkBpsc() {
  const response = await fetch(PAGE, {
    headers: { "User-Agent": "NandanDigitalSevaKendra/1.0" },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) throw new Error(`BPSC HTTP ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const notices = new Map();

  $("a[href]").each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim();
    const rawUrl = $(el).attr("href");

    if (!title || !rawUrl) return;

    let url;
    try {
      url = new URL(rawUrl, PAGE);
    } catch {
      return;
    }

    const relevant = /notice|advertisement|result|exam|recruitment|corrigendum|vacanc|answer.?key|admit.?card/i;
    const isBpscHost = url.hostname === "bpsc.bihar.gov.in";
    const isDocument = /\.(pdf|html?)$/i.test(url.pathname);

    if (
      isBpscHost &&
      isDocument &&
      relevant.test(title + " " + url.pathname) &&
      title.length >= 12
    ) {
      notices.set(url.href, { title: title.slice(0, 240), url: url.href });
    }
  });

  const current = [...notices.values()];
  const previous = readSeen();

  // First run: save existing notices as baseline, do not publish them.
  if (previous === null) {
    saveSeen(new Set(current.map(n => n.url)));
    console.log(`BPSC baseline saved: ${current.length} existing notice(s); none published.`);
    return [];
  }

  const seen = new Set(previous);
  const fresh = current.filter(n => !seen.has(n.url));

  for (const notice of fresh) seen.add(notice.url);
  saveSeen(seen);

  return fresh;
}

module.exports = { checkBpsc };
