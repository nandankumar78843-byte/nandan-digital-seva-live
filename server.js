require("dotenv").config();
const express=require("express"), Parser=require("rss-parser"), cron=require("node-cron"), fs=require("fs"), path=require("path");
const app=express(), parser=new Parser({
  timeout:15000,
  headers:{"User-Agent":"NandanDigitalSevaKendra/1.0 RSS reader"},
  customFields:{item:[["media:content","mediaContent"],["media:thumbnail","mediaThumbnail"]]}
});
const { checkBpsc } = require("./automation/bpsc-monitor");
const PORT=Number(process.env.PORT||3000), ADMIN_TOKEN=process.env.ADMIN_TOKEN||"", CHECK_CRON=process.env.CHECK_CRON||"*/5 * * * *";
const ROOT=__dirname;
const DATA_DIR=process.env.DATA_DIR || path.join(ROOT,"automation");
fs.mkdirSync(DATA_DIR,{recursive:true});
const SOURCES=path.join(DATA_DIR,"sources.json"), POSTS=path.join(DATA_DIR,"posts.json");
// On first cloud start, seed the persistent data directory from the project defaults.
for (const [target,seed] of [[SOURCES,path.join(ROOT,"automation/sources.json")],[POSTS,path.join(ROOT,"automation/posts.json")]]) {
  if (!fs.existsSync(target)) {
    try { fs.copyFileSync(seed,target); } catch { fs.writeFileSync(target,"[]\n","utf8"); }
  }
}
app.use(express.json({limit:"100kb"})); app.use(express.static(ROOT));
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return fallback}}
function write(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n","utf8")}
function clean(v,n=300){return String(v||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,n)}
function httpUrl(v){try{return ["https:","http:"].includes(new URL(v).protocol)}catch{return false}}
function admin(req,res,next){if(!ADMIN_TOKEN)return res.status(503).json({error:"à¤ªà¤¹à¤²à¥‡ .env à¤®à¥‡à¤‚ ADMIN_TOKEN à¤¸à¥‡à¤Ÿ à¤•à¤°à¥‡à¤‚ à¤”à¤° à¤¸à¤°à¥à¤µà¤° à¤°à¥€à¤¸à¥à¤Ÿà¤¾à¤°à¥à¤Ÿ à¤•à¤°à¥‡à¤‚à¥¤"});if(req.get("x-admin-token")!==ADMIN_TOKEN)return res.status(401).json({error:"Admin token गलत है।"});next()}
app.get("/api/health",(_q,r)=>r.json({ok:true,schedule:CHECK_CRON}));
app.get("/api/sources",(_q,r)=>r.json(read(SOURCES,[]).map(({id,name,url,enabled,category,rssUrl})=>({id,name,url,enabled,category,configured:!!rssUrl}))));
app.get("/api/posts",(_q,r)=>{r.set("Cache-Control","no-store");r.json(read(POSTS,[]).slice(0,500))});
app.put("/api/admin/sources/:id",admin,(req,res)=>{const list=read(SOURCES,[]),s=list.find(x=>x.id===req.params.id);if(!s)return res.status(404).json({error:"Source नहीं मिला"});const {rssUrl,enabled}=req.body||{};if(rssUrl!==undefined&&rssUrl!==""&&!httpUrl(rssUrl))return res.status(400).json({error:"वैध http/https RSS URL दें"});if(rssUrl!==undefined&&rssUrl!=="")s.rssUrl=rssUrl;if(enabled!==undefined)s.enabled=!!enabled;if(s.enabled&&!s.rssUrl)return res.status(400).json({error:"पहले सत्यापित RSS URL जोड़ें"});write(SOURCES,list);res.json({ok:true,id:s.id,enabled:s.enabled,configured:!!s.rssUrl})});
async function checkFeeds(){
  const list=read(SOURCES,[]);
  const posts=read(POSTS,[]);
  const known=new Set(posts.map(p=>p.guid));
  let added=0;

  // Existing RSS feeds
  for(const s of list.filter(x=>x.enabled&&x.rssUrl)){
    try{
      const feed=await parser.parseURL(s.rssUrl);
      for(const item of (feed.items||[]).slice(0,40).reverse()){
        const link=item.link||"";
        const guid=clean(item.guid||link||`${s.id}:${item.title}`,700);
        const title=clean(item.title,240);
        if(!title||!httpUrl(link)||known.has(guid))continue;

        posts.unshift({
          guid,title,
          summary:clean(item.contentSnippet||item.summary||"",280),
          sourceId:s.id,sourceName:s.name,category:s.category,
          url:link,
          imageUrl:(item.mediaThumbnail?.$?.url||item.enclosure?.url&&/^image\\//i.test(item.enclosure.type||"")?item.mediaThumbnail?.$?.url||item.enclosure.url:""),
          mediaUrl:(item.enclosure?.url&&/^video\\//i.test(item.enclosure.type||"")?item.enclosure.url:""),
          mediaType:item.enclosure?.type||"",
          publishedAt:item.isoDate||item.pubDate||new Date().toISOString(),
          importedAt:new Date().toISOString()
        });
        known.add(guid);
        added++;
      }
    }catch(e){
      console.error(`[feed error] ${s.name}: ${e.message}`);
    }
  }

  // BPSC official notices
  try{
    const notices=await checkBpsc();
    for(const item of notices){
      const guid=item.url;
      if(!item.title||!httpUrl(item.url)||known.has(guid))continue;

      posts.unshift({
        guid,
        title:clean(item.title,240),
        summary:"Official BPSC notice. Open the official link for full details.",
        sourceId:"bpsc",
        sourceName:"BPSC",
        category:"Government Jobs / Notices",
        url:item.url,
        publishedAt:new Date().toISOString(),
        importedAt:new Date().toISOString()
      });
      known.add(guid);
      added++;
    }
  }catch(e){
    console.error(`[BPSC monitor error] ${e.message}`);
  }

  if(added)write(POSTS,posts.slice(0,500));
  console.log(`${new Date().toISOString()} Automatic check: ${added} new post(s)`);
  return added;
}

app.post("/api/admin/check-now",admin,async(_q,r)=>{try{r.json({ok:true,added:await checkFeeds()})}catch(e){r.status(500).json({error:e.message})}});
app.get("/admin", (_req,res)=>res.sendFile(path.join(ROOT,"automation-admin.html")));

app.listen(PORT,()=>{console.log(`Website: http://localhost:${PORT}`);console.log(`Admin: http://localhost:${PORT}/admin`);if(!ADMIN_TOKEN)console.warn("Set ADMIN_TOKEN in .env before using admin routes.");cron.schedule(CHECK_CRON,()=>checkFeeds().catch(console.error));checkFeeds().catch(console.error)});


