const express    = require('express');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

// ── App ────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ───────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:      ["'self'"],
      styleSrc:        ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:         ["'self'", "https://fonts.gstatic.com"],
      scriptSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:          ["'self'", "data:", "blob:"],
      connectSrc:      ["'self'"],
      objectSrc:       ["'none'"],
      baseUri:         ["'self'"],
      formAction:      ["'self'"],
      frameAncestors:  ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── Rate limiting ──────────────────────────────────────
// General — 100 req/min per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте через минуту.' },
});

// Stricter — 30 req/min on /api routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Лимит запросов к API. Подождите минуту.' },
});

// Codes refresh — 1 per 30 sec max
const refreshLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Обновление кодов не чаще 1 раза в 30 секунд.' },
});

app.use(generalLimiter);
app.use('/api/', apiLimiter);

// ── Body parsing (size limit) ───────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// ── Static files ───────────────────────────────────────
app.use(express.static(path.join(__dirname)));

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
  { code: 'NTEGIFT',           reward: '50 Annulith, 5 Rising Hunter Guides, 5 Light Dye',                     isNew: false },
  { code: 'NTE0429',           reward: '100 Annulith, 2 Elite Hunter Guides, 2 Chaotic Dye, 12,000 Beetle Coins',isNew: false },
  { code: 'NTENANALLYGO',      reward: '100 Annulith, 5 Senior Hunter Guides, 5 Colorless Dye, 6,000 Beetle Coins', isNew: false },
  { code: 'NTENOWTOENJOY',     reward: '100 Annulith, 5 Rising Hunter Guides, 5 Light Dye, 4,000 Beetle Coins',  isNew: false },
];

// ── Code parser ────────────────────────────────────────
function parseCodes(html) {
  const codes = [];
  const seen  = new Set();

  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi,  '');

  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(clean)) !== null) {
    const raw = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const cm  = raw.match(/^([A-Z0-9]{4,30})(?:\s*[:\-]\s*)(.+)$/i);
    if (!cm) continue;

    const code   = cm[1].trim().toUpperCase();
    const reward = cm[2].trim().replace(/\s*NEW\s*$/i, '').trim();

    const SKIP = /^(HERE|THESE|WHILE|ONCE|AFTER|BELOW|NOTE|FIND|OPEN|MAKE|SURE|ENTER|SELECT|TYPE|ABOVE|STEP|THEN|THIS|THAT|ALSO|JUST|NEXT|BACK|FIRST|LAST|EACH|SUCH|SOME|MOST|FROM|INTO|OVER|UPON|WITH|YOUR|HAVE|WILL|BEEN|THEY|WHAT|WHEN|WHERE|WHICH|HOW|WHO)$/i;
    if (SKIP.test(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);

    codes.push({ code, reward, isNew: /NEW/i.test(m[1] + cm[2]) });
  }
  return codes;
}

// ── /api/codes ─────────────────────────────────────────
// Special strict limiter for code refresh
app.get('/api/codes', refreshLimiter, async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('X-Content-Type-Options', 'nosniff');

  try {
    const now = Date.now();

    // Return cached if fresh
    if (codesCache && (now - cacheTime) < CACHE_TTL) {
      return res.json({ ...codesCache, cached: true });
    }

    const SOURCES = [
      'https://www.eurogamer.net/neverness-to-everness-nte-codes',
      'https://www.pockettactics.com/neverness-to-everness/codes',
      'https://www.polygon.com/neverness-to-everness-codes-list-redeem-how-to/',
    ];

    let codes = [], source = 'fallback', live = false;

    for (const url of SOURCES) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
            'Accept': 'text/html',
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
      } catch (_) { /* next source */ }
    }

    if (!live) {
      codes  = FALLBACK_CODES;
      source = 'eurogamer.net (fallback)';
    }

    codesCache = { codes, updatedAt: new Date().toISOString(), source, live };
    cacheTime  = now;
    res.json(codesCache);

  } catch (err) {
    res.status(500).json({
      codes: FALLBACK_CODES,
      updatedAt: new Date().toISOString(),
      source: 'fallback',
      live: false,
      error: 'Внутренняя ошибка сервера',
    });
  }
});

// ── Catch-all (SPA) ────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Error handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Неверный формат запроса' });
  }
  if (err.status === 429) {
    return res.status(429).json({ error: 'Слишком много запросов' });
  }
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ── Start ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[CYBER//HUB] Server online → port ${PORT}`);
  console.log(`[SECURITY] Helmet CSP, rate-limiting, size-limits active`);
});
