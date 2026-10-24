const cheerio = require("cheerio");

async function main() {
  const response = await fetch("https://bpsc.bihar.gov.in/whats-new/");
  console.log("Status:", response.status);

  const html = await response.text();
  const $ = cheerio.load(html);

  $("a").each((i, el) => {
    const title = $(el).text().trim().replace(/\s+/g, " ");
    const url = $(el).attr("href");

    if (title && url && /notice|advertisement|result|exam|download|bpsc/i.test(title + " " + url)) {
      console.log(title.slice(0, 120), "|", url);
    }
  });
}

main().catch(console.error);
