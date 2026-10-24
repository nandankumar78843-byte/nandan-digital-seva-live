# NANDAN DIGITAL SEVA — Cloud-ready RSS automation

## क्या तैयार है
- Node.js/Express वेबसाइट और APIs: `/api/health`, `/api/sources`, `/api/posts`
- RSS/API feeds की scheduled जाँच (डिफ़ॉल्ट हर 5 मिनट)
- duplicate रोकना और अधिकतम 500 posts रखना
- `/admin` पर RSS sources का प्रबंधन और manual check
- Render blueprint (`render.yaml`) में always-on Starter service और persistent disk
- persistent disk पर sources/posts/BPSC seen-state ताकि service restart पर data बना रहे

## महत्वपूर्ण सीमाएँ
- यह RSS/API उपलब्ध कराने वाले और enabled किए गए स्रोतों से ही अपडेट लाता है; सभी वेबसाइटों की हर सूचना की गारंटी नहीं है।
- RSS/API न देने वाली साइटों को बिना अनुमति scrape नहीं किया जाता। स्रोतों के उपयोग/attribution की शर्तें जाँचें।
- यह केवल शीर्षक, छोटा सार और मूल लिंक रखता है, पूरा लेख कॉपी नहीं करता।
- Render blueprint में Starter plan और 1 GB persistent disk है, जो paid हो सकते हैं। Free hosting में service sleep या local data loss हो सकता है। कीमत/availability Render पर जाँचें।
- Deploy पूरा करने के लिए GitHub/Render में आपकी ओर से account setup और confirmation जरूरी है; कोई password/token साझा न करें।

## स्थानीय परीक्षण
1. Node.js LTS इंस्टॉल करें: https://nodejs.org/
2. ZIP extract करें और उस folder में terminal खोलें।
3. `.env.example` की copy बनाकर `.env` नाम दें और `ADMIN_TOKEN` को लंबा random secret दें।
4. `npm install`
5. `npm start`
6. खोलें: `http://localhost:3000`, Admin: `http://localhost:3000/admin`, Health: `http://localhost:3000/api/health`

## Cloud deploy (Render)
1. इस folder को GitHub repository में upload करें (node_modules upload न करें)।
2. Render account खोलें: https://render.com/
3. New → Blueprint चुनें और GitHub repository connect करें।
4. Render `render.yaml` पढ़कर service बनाएगा। Blueprint Starter plan/persistent disk चुनता है; खर्च स्वीकार करने से पहले pricing देख लें।
5. Deploy के बाद service URL में `/api/health` खोलकर `ok: true` देखें।
6. `/admin` खोलें। Render Dashboard → service → Environment में generated `ADMIN_TOKEN` देखें/बदलें; इसे सार्वजनिक न करें। Admin में token दर्ज कर feeds जाँचें।

## Source feed management
`automation/sources.json` में default sources हैं। केवल verified RSS/API URL को enable करें। Admin से URL जोड़ने पर वह persistent disk पर सहेजा जाएगा।

## WhatsApp
WhatsApp/Channel auto-posting इस build में शामिल नहीं है।


## Homepage update
- मुख्य पेज अब `index.html` है। सर्वर के root URL `/` पर यही खुलेगा।
- दूसरे पेजों के “मुख्य वेबसाइट” लिंक भी `index.html` पर अपडेट किए गए हैं।

## 24x7 hosting — ज़रूरी बात
- मौजूदा `render.yaml` में Starter plan और 1 GB persistent disk है; ये paid हो सकते हैं। इससे always-on service और persistent storage का लक्ष्य पूरा हो सकता है, लेकिन यह ₹0 hosting नहीं है।
- Render Free plan पर service inactivity के बाद sleep हो सकती है और persistent disk उपलब्ध नहीं होती। इसलिए ₹0 पर 24x7 uptime, लगातार हर 5 मिनट में RSS/BPSC checks और durable local JSON storage — तीनों की गारंटी नहीं दी जा सकती।
- Free plan चुनने पर खर्च नहीं होगा, लेकिन scheduled checks तभी भरोसेमंद होंगे जब app चल रही हो; restart/sleep के बाद local JSON data खो सकता है।
- कोई paid service चुनने से पहले dashboard में pricing और disk charges ज़रूर देखें। `ADMIN_TOKEN` को secret रखें।
