/**
 * Express application: security middleware, API routes, Swagger docs and
 * (in production) the built React client, all served from one origin.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const config = require('./config');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1); // behind Render's proxy: correct client IPs and secure cookies

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'", 'ws:', 'wss:'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

// ---- API documentation (OpenAPI 3 / Swagger UI)
const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, 'docs/openapi.yaml'), 'utf8'));
app.get('/api/docs.json', (_req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'CampusFix API Docs',
  swaggerOptions: { persistAuthorization: true },
}));

// ---- API
app.use('/api', apiRoutes);
app.use('/api', notFound);

// ---- React client (production build)
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '7d', index: false }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
