import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import env from './config/env.js'
import ApiError from './utils/ApiError.js'
import { apiLimiter } from './middleware/rateLimit.js'
import notFound from './middleware/notFound.js'
import errorHandler from './middleware/errorHandler.js'
import routes from './routes/index.js'

const app = express()

app.disable('x-powered-by')

// Security headers
app.use(helmet())

// CORS — allow only configured origins; requests without an Origin header
// (curl, server-to-server, tests) are allowed. Vercel preview deployments
// (*.vercel.app) are matched by pattern, not wildcard, since credentials are
// not used (Bearer token auth). The cors package handles OPTIONS preflight
// automatically for allowed origins.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)

      if (env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
        return callback(null, true)
      }

      // Vercel preview deployments: allow *.vercel.app subdomains safely.
      // Not a wildcard — only vercel.app subdomains match.
      if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true)
      }

      callback(ApiError.forbidden(`Origin not allowed: ${origin}`))
    },
  }),
)

app.use(express.json({ limit: '100kb' }))

// Rate limiting on the whole API surface
app.use('/api', apiLimiter)

app.use('/api', routes)

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "XPO API is running"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy"
  });
});

app.use(notFound)
app.use(errorHandler)

export default app
