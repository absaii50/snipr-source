import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import rateLimit from "express-rate-limit";
import pg from "pg";
import router from "./routes";
import redirectRouter from "./routes/redirect";
import { logger } from "./lib/logger";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  logger.fatal("SESSION_SECRET environment variable is required in production");
  process.exit(1);
}

const PgSession = connectPgSimple(session);

const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const app: Express = express();

// Trust the first proxy hop (Replit's reverse proxy) so req.ip reflects real client IP
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(compression());

// CORS: Whitelist only allowed origins to prevent cross-site attacks
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "https://snipr.sh",
];

// Replit dev domain patterns (*.replit.dev, *.riker.replit.dev, *.picard.replit.dev)
const replitDevPattern = /^https:\/\/[a-zA-Z0-9-]+(\.picard|\.riker)?\.replit\.dev(:\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      // Same-origin or server-to-server requests — allow
      callback(null, true);
    } else if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (replitDevPattern.test(origin)) {
      // Allow all Replit dev preview domains
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS policy"));
    }
  },
  credentials: true,
}));
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as import("express").Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: sessionSecret ?? "snipr-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Rate limiting — redirects (all paths): 120/min per IP; API endpoints: 200/min per IP
// Dashboard alone fires 7+ simultaneous requests per page load; 30/min was far too strict
const redirectLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "HEAD",
  message: { error: "Too many requests. Please slow down." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// SECURITY: Rate limit admin login endpoint separately (strict)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5, // Only 5 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
  skip: (req) => req.method !== "POST" || req.path !== "/admin/login",
});

app.use("/api/", adminLoginLimiter); // Apply strict rate limiting first
app.use("/api/", apiLimiter);
app.use("/api", router);

// Apply redirect limiter to both /r/ slugs AND custom-domain catch-all redirects
app.use(redirectLimiter);
app.use(redirectRouter);

// Global error handler — catches any unhandled error from async route handlers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err, "Unhandled error");
  const status = (err instanceof Error && "status" in err && typeof (err as { status: unknown }).status === "number")
    ? (err as { status: number }).status
    : 500;
  const message = err instanceof Error ? err.message : "Internal Server Error";
  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
});

export default app;
