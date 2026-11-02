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
// (curl, server-to-server, tests) are allowed.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
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

app.use(notFound)
app.use(errorHandler)

export default app
