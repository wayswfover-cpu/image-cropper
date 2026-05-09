const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Cache ──────────────────────────────────────────────
let codesCache = null;
let cacheTime  = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Fallback hardcoded codes (May 2026) ───────────────
const FALLBACK_CODES = [
  { code: 'NTEFREE',           reward: '30,000 Fons',                                                            isNew: true  },
  { code: 'NTEvtuber200',      reward: '10,000 Beetle Coins, 10,000 Fons',                                       isNew: false },
  { code: '504980102FKGOVNS',  reward: '30 Annulith, 20,000 Beetle Coins',                                       isNew: false },
  { code: 'NTEHAVEFUN',        reward: '3 Elite Hunter Guides, 3 Light Dye, 3 Manhole Thug',                     isNew: false },
  { code: 'NTEGIFT',           reward: '50 Annulith, 5 Rising Hunter Guides, 5 Light Dye',                       isNew: false },
  { code: 'NTE0429',           reward: '100 Annulith, 2 Elite Hunter Guides, 2 Chaotic Dye, 12,000 Beetle Coins',isNew: false },
  { code: 'NTENANALLYGO',      reward: '100 Annulith, 5 Senior Hunter Guides, 5 Colorless Dye, 6,000 Beetle Coins', isNew: false },
  { code: 'NTENOWTOENJOY',     reward: '100 Annulith, 5 Rising Hunter Guides, 5 Light Dye, 4,000 Beetle Coins',  isNew: false },
];

// ── HTML list-item code parser ─────────────────────────
function parseCodes(html) {
  const codes = [];
  const seen  = new Set();

  // Strip script/style blocks to avoid noise
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi,  '');

  // Match <li>…</li> blocks
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(clean)) !== null) {
    const raw = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Pattern: CODENAME: reward  OR  CODENAME - reward
    const cm = raw.match(/^([A-Z0-9]{4,30})(?:\s*[:\-]\s*)(.+)$/i);
    if (!cm) continue;

    const code = cm[1].trim().toUpperCase();
    const reward = cm[2].trim().replace(/\s*NEW\s*$/i, '').trim();

    // Skip obvious non-codes (English stop-words)
    const SKIP = /^(HERE|THESE|WHILE|ONCE|AFTER|BELOW|NOTE|FIND|OPEN|MAKE|SURE|ENTER|SELECT|TYPE|ABOVE|STEP|THEN|THIS|THAT|ALSO|JUST|NEXT|BACK|FIRST|LAST|EACH|SUCH|SOME|MOST|FROM|INTO|OVER|UPON|WITH|YOUR|HAVE|WILL|BEEN|THEY|WHAT|WHEN|WHERE|WHICH|HOW|WHO)$/i;
    if (SKIP.test(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);

    codes.push({ code, reward, isNew: /NEW/i.test(m[1] + cm[2]) });
  }
  return codes;
}

// ── /api/codes endpoint ────────────────────────────────
app.get('/api/codes', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  try {
    const now = Date.now();
    if (codesCache && (now - cacheTime) < CACHE_TTL) {
      return res.json(codesCache);
    }

    const SOURCES = [
      'https://www.eurogamer.net/neverness-to-everness-nte-codes',
      'https://www.pockettactics.com/neverness-to-everness/codes',
      'https://www.polygon.com/neverness-to-everness-codes-list-redeem-how-to/',
    ];

    let codes  = [];
    let source = 'fallback';
    let live   = false;

    for (const url of SOURCES) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(9000),
        });
        if (!response.ok) continue;
        const html   = await response.text();
        const parsed = parseCodes(html);
        if (parsed.length >= 3) {
          codes  = parsed;
          source = url;
          live   = true;
          break;
        }
      } catch (_) { /* try next source */ }
    }

    if (codes.length === 0) {
      codes  = FALLBACK_CODES;
      source = 'eurogamer.net (fallback)';
      live   = false;
    }

    codesCache = { codes, updatedAt: new Date().toISOString(), source, live };
    cacheTime  = now;
    res.json(codesCache);
  } catch (err) {
    res.json({ codes: FALLBACK_CODES, updatedAt: new Date().toISOString(), source: 'fallback', error: err.message });
  }
});

// ── Static files ───────────────────────────────────────
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`[CYBER//HUB] Server online → port ${PORT}`));
