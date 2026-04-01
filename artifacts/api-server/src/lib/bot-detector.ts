/**
 * Snipr — Comprehensive Bot & Non-Human Traffic Detector
 * ──────────────────────────────────────────────────────────
 * Detects 200+ known bots, crawlers, scrapers, prefetch agents,
 * link preview generators, monitoring tools, AI crawlers, and more.
 *
 * Used to filter non-human traffic from click analytics.
 */

import { Request } from "express";

// ── 1. Search Engine Crawlers ─────────────────────────────────────────────
const SEARCH_ENGINE_BOTS = [
  // Google (20+ variants)
  "googlebot", "google-inspectiontool", "googleother", "google-extended",
  "google-safety", "googleproducer", "google-site-verification",
  "google-structured-data-testing-tool", "google-xrawler", "googledocs",
  "googleimageproxy", "mediapartners-google", "mediapartners", "adsbot-google",
  "adsbot", "apis-google", "feedfetcher-google", "google-read-aloud",
  "duplex", "googleweblight", "storebot-google",

  // Bing / Microsoft (10+ variants)
  "bingbot", "bingpreview", "msnbot", "msnbot-media", "adidxbot",
  "microsoftpreview", "binglocalsearch", "microsoftdocs",

  // Yahoo
  "slurp", "yahoo", "yahoodirbot",

  // Yandex (8+ variants)
  "yandexbot", "yandexaccessibilitybot", "yandexblogs", "yandexcalendar",
  "yandexdirect", "yandexfavicons", "yandexfordomain", "yandeximages",
  "yandexmarket", "yandexmedia", "yandexmetrika", "yandexnews",
  "yandexpagechecker", "yandexscreenshotbot", "yandexturbo", "yandexvertis",
  "yandexvideo", "yandexwebmaster",

  // Baidu
  "baiduspider", "baiduspider-image", "baiduspider-video", "baiduspider-news",

  // DuckDuckGo
  "duckduckbot", "duckduckgo-favicons-bot", "duckassistbot",

  // Apple
  "applebot",

  // Other search engines
  "sogou", "sosospider", "exabot", "qwantify", "ia_archiver",
  "seznam", "seznambot", "ccbot", "naver", "yeti", "coccoc",
  "mojeekbot", "petalbot", "barkrowler", "ecosia",
];

// ── 2. Social Media / Chat Preview Bots ──────────────────────────────────
const SOCIAL_MEDIA_BOTS = [
  // Facebook / Meta
  "facebookexternalhit", "facebookcatalog", "facebot", "meta-externalagent",

  // Twitter / X
  "twitterbot", "tweetmemebot",

  // LinkedIn
  "linkedinbot", "linkedin",

  // WhatsApp
  "whatsapp",

  // Telegram
  "telegrambot", "telegram",

  // Discord
  "discordbot",

  // Slack
  "slackbot", "slack-imgproxy", "slackbot-linkexpanding",

  // Pinterest
  "pinterest", "pinterestbot",

  // Snapchat
  "snapchat",

  // Viber
  "viber",

  // Line
  "line",

  // Skype
  "skypeuripreview",

  // Reddit
  "redditbot",

  // Tumblr
  "tumblr",

  // Instagram (in-app browser uses fb externalhit too)
  "instagram",

  // WeChat
  "micromessenger",

  // KakaoTalk
  "kakaotalk-scrap", "kakaostory-og-reader",

  // Mastodon
  "mastodon",

  // Other messaging
  "zalobot", "threema",
];

// ── 3. AI / LLM Crawlers ────────────────────────────────────────────────
const AI_BOTS = [
  // OpenAI
  "gptbot", "chatgpt-user", "oai-searchbot",

  // Anthropic
  "claudebot", "claude-web", "anthropic-ai",

  // Perplexity
  "perplexitybot",

  // Cohere
  "cohere-ai",

  // Google AI
  "google-extended",

  // Meta AI
  "meta-externalagent", "facebookbot",

  // ByteDance / TikTok
  "bytespider", "bytedance", "tiktokbot",

  // Amazon / Alexa
  "amazonbot", "alexabot",

  // Apple AI
  "apple-cloudkit", "applebot-extended",

  // Common Crawl (used to train AI)
  "ccbot",

  // Diffbot
  "diffbot",

  // Neeva
  "neevabot",

  // YouBot (you.com)
  "youbot",

  // Brave
  "bravebot",

  // AI2 (Allen Institute)
  "ai2bot",

  // Webz.io
  "omgili", "omgilibot",

  // Timpibot
  "timpibot",

  // Velenpublicwebcrawler
  "velenpublicwebcrawler",

  // Kangaroo Bot
  "kangaroobot",

  // GPT crawlers
  "gpt",
];

// ── 4. SEO / Marketing Tool Crawlers ────────────────────────────────────
const SEO_BOTS = [
  // Ahrefs
  "ahrefsbot", "ahrefssiteaudit",

  // SEMrush
  "semrushbot", "semrushbot-ba", "semrushbot-bm", "semrushbot-ct",
  "semrushbot-sa", "semrushbot-si", "semrushbot-swa",
  "splitpagesignalbot",

  // Moz
  "dotbot", "rogerbot", "mj12bot",

  // Majestic
  "majestic12", "mj12bot",

  // Screaming Frog
  "screaming frog seo spider",

  // Sistrix
  "sistrix",

  // SpyFu
  "spyfu",

  // Serpstat
  "serpstatbot",

  // Raven
  "raventools",

  // DeepCrawl / Lumar
  "deepcrawl",

  // ContentKing
  "contentkingapp",

  // Sitebulb
  "sitebulb",

  // OnCrawl
  "oncrawl",

  // BrightEdge
  "brightedge",

  // Conductor
  "conductor",

  // Botify
  "botify",

  // seostar
  "seostar",

  // DataForSEO
  "dataforseo",

  // Webmeup
  "blexbot", "blex",

  // ZoominfoBot
  "zoominfobot",

  // Other marketing
  "hubspot", "marketo", "pardot", "salesforce",
];

// ── 5. Monitoring / Uptime / Health Check Bots ──────────────────────────
const MONITORING_BOTS = [
  // Uptime monitors
  "uptimerobot", "pingdom", "statuscake", "hetrixtools",
  "site24x7", "freshping", "updown.io", "montastic",
  "nodeping", "checkhost", "uptrends", "uptimia",

  // APM & Infra
  "datadog", "newrelic", "dynatrace", "appdynamics",
  "elastic", "prometheus", "grafana", "zabbix", "nagios",
  "prtg", "solarwinds", "thousandeyes",

  // Synthetic monitoring
  "catchpoint", "rigor", "keynote",

  // Health checks
  "kube-probe", "elb-healthchecker", "googlehc",
  "aws-health", "azure-traffic-manager",

  // Dead link checkers
  "w3c_validator", "w3c-checklink", "linkchecker", "deadlinkchecker",
  "brokenlinkcheck", "linkwalker", "checkbot", "screaming frog",
];

// ── 6. Security Scanners & Vulnerability Tools ──────────────────────────
const SECURITY_BOTS = [
  "nessus", "qualys", "nmap", "nikto", "openvas", "burpsuite",
  "owasp", "sqlmap", "dirbuster", "gobuster", "wpscan", "nuclei",
  "masscan", "shodan", "censys", "internetmeasurement",
  "zgrab", "zmapproject", "securitytrails",
  "intrigue", "sn1per",
];

// ── 7. Feed Readers & Aggregators ───────────────────────────────────────
const FEED_BOTS = [
  "feedly", "feedparser", "feedspot", "newsblur", "inoreader",
  "theoldreader", "netvibes", "feedbin", "feedwrangler",
  "miniflux", "tiny tiny rss", "liferea", "netnewswire",
  "rssowl", "feedreader", "feedvalidator", "universalfeedparser",
  "blogtrottr", "superfeedr",
];

// ── 8. Archive / Research Crawlers ──────────────────────────────────────
const ARCHIVE_BOTS = [
  // Internet Archive
  "archive.org_bot", "wayback", "ia_archiver",

  // Common Crawl
  "ccbot",

  // Academic
  "researchscan", "university", "academic",

  // Turnitin
  "turnitinbot",

  // Library
  "libwww", "httrack", "offline explorer",
];

// ── 9. CLI / HTTP Tools ─────────────────────────────────────────────────
const CLI_TOOLS = [
  "curl", "wget", "httpie", "aria2", "lynx", "links", "elinks",
  "w3m", "fetch", "undici", "got", "superagent",
];

// ── 10. Headless Browsers & Automation ──────────────────────────────────
const HEADLESS_BOTS = [
  "headlesschrome", "headless", "phantomjs", "phantom",
  "puppeteer", "playwright", "selenium", "webdriver",
  "cypress", "nightwatch", "zombie", "slimerjs",
  "htmlunit", "mechanize", "scrapy", "nutch",
  "heritrix", "colly", "goutte",
];

// ── 11. HTTP Libraries / SDKs ───────────────────────────────────────────
const HTTP_LIBRARIES = [
  "python-requests", "python-urllib", "python-httpx", "aiohttp",
  "httplib2", "pycurl",
  "axios", "node-fetch", "undici", "superagent", "request",
  "got/", "needle", "bent", "phin",
  "go-http-client", "go-resty",
  "java/", "apache-httpclient", "okhttp", "jersey",
  "ruby", "faraday", "rest-client", "typhoeus",
  "perl", "lwp", "libwww-perl",
  "php", "guzzlehttp", "guzzle",
  "dart", "http.client",
  "rust", "reqwest", "hyper",
  "swift", "alamofire", "nsurlsession",
  "kotlin",
];

// ── 12. Web Scrapers / Content Extractors ───────────────────────────────
const SCRAPERS = [
  "scrapy", "colly", "goutte", "httrack", "sitesucker",
  "webcopier", "teleport", "website-mirrorer",
  "getright", "grabber", "download demon",
  "flashget", "leechftp", "webzip",
  "extract", "harvest", "collector",
  "webscraper", "dataminer", "import.io",
  "scrapyrt", "beautifulsoup",
  "newspaper", "readability", "diffbot",
  "embedly", "iframely", "microlink",
  "unfurl", "open-graph-scraper",
];

// ── 13. Email / Newsletter Clients (Pre-fetching links) ─────────────────
const EMAIL_BOTS = [
  "outlook", "thunderbird", "apple-mail",
  "googleimageproxy", "yahoo-mailproxy",
  "mailchimp", "sendgrid", "mailgun", "postmark",
  "sparkpost", "amazonses", "mandrill",
  "litmus", "email on acid",
  "returnpath", "250ok",
];

// ── 14. Preview / Embed / OG Fetchers ───────────────────────────────────
const PREVIEW_BOTS = [
  "preview", "embed", "oembed", "opengraph",
  "og-image", "metatags", "link-preview",
  "unfurl", "card-fetch",
  "vkshare", "okhttp",
  "outbrain", "taboola",
  "flipboard", "pocket",
  "instapaper", "readability",
  "summify",
];

// ── 15. Misc Known Bots ─────────────────────────────────────────────────
const MISC_BOTS = [
  // Generic bot identifiers
  "bot", "crawl", "spider", "scraper", "checker", "scanner",
  "monitor", "analyzer", "inspector", "validator",

  // Specific bots
  "360spider", "acunetix", "addthis", "adscanner",
  "baiduspider", "barkrowler", "blekkobot", "bsalsa",
  "catchbot", "changedetection", "cis455crawler",
  "cliqzbot", "cloudsystemnetworks", "cocolyzebot",
  "comodo", "crawler4j", "crystalsemanticsbot",
  "daum", "discobot", "domaincrawler",
  "duckduckbot", "ezooms", "fastbot",
  "findlinks", "gazebobot", "gigabot",
  "grapeshot", "hatena", "heritrix",
  "icc-crawler", "ichiro", "infoseek",
  "ips-agent", "iskanie", "jamesjbot",
  "jetslide", "jooblebot", "kaz.kz_bot",
  "larbin", "ltx71", "mail.ru_bot",
  "megaindex", "moatbot", "moreover",
  "multiviewbot", "netcraft", "netpeakspider",
  "obot", "openindexspider", "orangebot",
  "pagepeeker", "paperlibot", "plukkie",
  "pompos", "postrank", "quora link preview",
  "qwantify", "rankactivelinkbot",
  "reaper", "redditbot", "riddler",
  "rivva", "sbl-bot", "seokicks",
  "seoscanners", "siteexplorer", "skypeuripreview",
  "snap url preview", "sogou", "spbot",
  "startmebot", "steeler", "stq_bot",
  "surveybot", "tineye", "toplistbot",
  "traackr", "tweetedtimes", "twengabot",
  "twitterbot", "urlappendbot", "vagabondo",
  "vebidoobot", "voilabot", "wbsearchbot",
  "web-archive", "webalta", "webceo",
  "webmon", "wesee", "wikido",
  "woorank", "woriobot", "wotbox",
  "xovibot", "y!j-asr", "yacybot",
  "yisouspider", "zumbot",
];

// ─── Build Master Pattern ─────────────────────────────────────────────────

// Combine all bot lists, deduplicate, escape regex special chars
const ALL_BOTS = [
  ...SEARCH_ENGINE_BOTS,
  ...SOCIAL_MEDIA_BOTS,
  ...AI_BOTS,
  ...SEO_BOTS,
  ...MONITORING_BOTS,
  ...SECURITY_BOTS,
  ...FEED_BOTS,
  ...ARCHIVE_BOTS,
  ...CLI_TOOLS,
  ...HEADLESS_BOTS,
  ...HTTP_LIBRARIES,
  ...SCRAPERS,
  ...EMAIL_BOTS,
  ...PREVIEW_BOTS,
  ...MISC_BOTS,
];

// Deduplicate and sort by length (longest first for better matching)
const uniqueBots = [...new Set(ALL_BOTS.map(b => b.toLowerCase()))].sort((a, b) => b.length - a.length);

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a single efficient regex from all patterns
const BOT_UA_PATTERN = new RegExp(
  uniqueBots.map(escapeRegex).join("|"),
  "i"
);

// ─── Prefetch / Prerender Headers ───────────────────────────────────────

const PREFETCH_HEADERS = ["purpose", "x-purpose", "x-moz", "sec-purpose"] as const;
const PREFETCH_VALUES = /prefetch|prerender|preview/i;

// ─── Real Browser Detection ─────────────────────────────────────────────
// In-app browsers (WhatsApp, Instagram, Telegram, Facebook, LinkedIn, etc.)
// have the app name in their UA but ALSO include full browser engine strings.
// Pure bots do NOT have Mozilla/5.0 + browser engine.
//
// Example: WhatsApp in-app browser (REAL user — must count):
//   "Mozilla/5.0 (iPhone; ...) AppleWebKit/605.1.15 ... Mobile/15E148 WhatsApp/23.20"
//
// Example: WhatsApp preview bot (NOT a user — must block):
//   "WhatsApp/2.23.20.0"

const REAL_BROWSER_PATTERN = /^Mozilla\/5\.0\s.+(?:AppleWebKit|Chrome|Firefox|Safari|Edg|OPR|Opera|Trident|Gecko)/i;

// ─── Main Detection Function ────────────────────────────────────────────

/**
 * Returns `true` if the request is from a bot, crawler, prefetch agent,
 * or any other non-human source that should NOT be counted as a click.
 */
export function isBot(req: Request): boolean {
  // 1. HEAD requests — browsers/tools send HEAD before GET
  if (req.method === "HEAD") return true;

  // 2. OPTIONS / TRACE / other non-GET methods
  if (req.method !== "GET") return true;

  // 3. Empty or missing User-Agent — real browsers always send one
  const ua = (req.headers["user-agent"] ?? "") as string;
  if (!ua || ua.length < 10) return true;

  // 4. Prefetch / Prerender headers — check BEFORE browser detection
  //    because even real browsers can send prefetch requests
  for (const header of PREFETCH_HEADERS) {
    const value = req.headers[header];
    if (value && PREFETCH_VALUES.test(value as string)) return true;
  }

  // 5. Real browser check — if UA has Mozilla/5.0 + browser engine,
  //    it's a real user (possibly in an in-app browser like WhatsApp,
  //    Instagram, Telegram, Facebook, LinkedIn, etc.). ALLOW these.
  if (REAL_BROWSER_PATTERN.test(ua)) return false;

  // 6. Check against comprehensive bot UA pattern
  //    Only reaches here for non-browser UAs (pure bots, CLI tools, etc.)
  if (BOT_UA_PATTERN.test(ua)) return true;

  // 7. If UA doesn't match a real browser AND doesn't match a known bot,
  //    allow it (could be an unusual but legitimate browser)
  return false;
}

/**
 * Returns the detected bot name (for logging), or null if human.
 */
export function detectBotName(ua: string): string | null {
  if (!ua || ua.length < 10) return "empty-ua";
  const match = ua.match(BOT_UA_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Returns the count of unique bot patterns in the detector.
 */
export function getBotPatternCount(): number {
  return uniqueBots.length;
}
