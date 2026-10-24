# NANDAN DIGITAL SEVA KENDRA — Ready Build

## Windows par website chalane ka sabse aasan tareeqa
1. ZIP ko poori tarah Extract karein.
2. Extracted folder ke andar `START-WEBSITE.bat` par double-click karein.
3. Pehli baar ye dependencies install karega; internet connection zaroori hai.
4. Browser mein `http://localhost:3000` khulega.
5. Server chalte rehne ke liye kaali terminal window band na karein. Server rokne ke liye terminal mein `Ctrl+C` dabayein.

PowerShell mein manually chalana ho to:
```powershell
npm.cmd install
npm.cmd start
```
`npm.ps1` execution-policy error se bachne ke liye Windows PowerShell mein `npm.cmd` use karein.

## Zaroori URLs
- Website: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Health check: `http://localhost:3000/api/health`
- Posts API: `http://localhost:3000/api/posts`

## Admin setup
`.env.example` ki copy banakar uska naam `.env` rakhein. `.env` mein `ADMIN_TOKEN` ko apne lambe, private secret se replace karein; phir server restart karein. Token kisi ko ya public GitHub repository mein share na karein.

## GitHub / free hosting
- GitHub par ZIP nahi, extracted project files upload karein.
- `render.yaml` paid Starter plan aur persistent disk use karta hai. ₹0 hosting ke liye Render dashboard par Free service ko manually select karein ya optional `render-free-example.yaml` ko blueprint ke liye use karne se pehle default `render.yaml` ka dhyan rakhein.
- Free hosting sleep kar sakti hai; har 5 minute updates aur persistent data ki guarantee nahi hoti.
- Localhost sirf aapke computer par khulta hai. Internet par public website ke liye hosting par deploy karna zaroori hai.

## Files
Purani `server.js` aur baaki project files ko preserve kiya gaya hai. `npm start` ab `server-updated.js` chalata hai, jo flat/root file layout ko support karta hai. Homepage illustration `computer-hero.svg` root se load hoti hai.
