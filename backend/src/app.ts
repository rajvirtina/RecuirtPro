import express, { Application } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser'; // BUG-001: httpOnly cookie support
import config from './config';
import { errorHandler, notFound, limiter, xssSanitize } from './middleware';
import { stream } from './utils/logger';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// Import routes
import authRoutes from './routes/auth';
import jobRoutes from './routes/jobs';
import applicationRoutes from './routes/applications';
import interviewRoutes from './routes/interviews';
import proctoringRoutes from './routes/proctoring';
import calendarRoutes from './routes/calendar';
import questionRoutes from './routes/questions';
import sourcingRoutes from './routes/sourcing';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import offerRoutes from './routes/offers';
import notificationRoutes from './routes/notifications';
import hrRoutes from './routes/hr';
import gdprRoutes from './routes/gdprRoutes';
import invitationRoutes from './routes/invitations';
// import userRoutes from './routes/user';
// ... other routes

const app: Application = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RecuirtPro API',
      version: '1.0.0',
      description: 'Recruitment Process Automation Platform API Documentation',
      contact: {
        name: 'RecuirtPro Support',
        email: 'support@recruitpro.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
// Trust proxy in production (Hostinger/Nginx reverse proxy)
if (config.env === 'production') {
  app.set('trust proxy', 1);
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // BUG-001: parse httpOnly cookies

// SEC-12: Protect uploads behind authentication instead of serving publicly.
// Resumes are served via the /api/v1/applications/:id/resume endpoint which
// performs authorization checks. Static serving is restricted to non-resume
// assets only in development; in production, use S3 signed URLs.
if (config.env === 'development') {
  app.use('/uploads', express.static('uploads'));
}

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // In development, allow all origins
      if (config.env === 'development') {
        return callback(null, true);
      }
      
      // In production, check against whitelist
      if (config.corsOrigin.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(mongoSanitize());
app.use(xssSanitize);
app.use(compression());

// Rate limiting
app.use('/api', limiter);

// Morgan HTTP logger
if (config.env !== 'test') {
  const morgan = require('morgan');
  app.use(morgan('combined', { stream }));
}

// API Documentation — SEC-10: Protect Swagger UI in production
if (config.env !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/proctoring', proctoringRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/sourcing', sourcingRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/gdpr', gdprRoutes);
app.use('/api/v1/invitations', invitationRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/notifications', notificationRoutes);
// app.use('/api/v1/users', userRoutes);
// app.use('/api/v1/reports', reportRoutes);

// Serve frontend in production
if (config.env === 'production') {
  const fs = require('fs');
  // Primary: backend/public/ (co-located, works on Hostinger with root=backend)
  // Fallback: ../../frontend/dist (monorepo structure)
  const candidates = [
    path.join(__dirname, '../public'),
    path.join(__dirname, '../../public'),
    path.join(__dirname, '../../frontend/dist'),
    path.join(__dirname, '../../../frontend/dist'),
  ];
  const frontendDist = candidates.find(p => fs.existsSync(path.join(p, 'index.html')));

  if (frontendDist) {
    const indexPath = path.join(frontendDist, 'index.html');
    console.log(`Frontend found at: ${frontendDist}`);
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => res.sendFile(indexPath));
  } else {
    console.warn(`Frontend not found. __dirname: ${__dirname}`);
    app.get('/', (_req, res) => {
      res.json({ success: true, message: 'RecuirtPro API', version: '1.0.0', note: 'Frontend not found' });
    });
  }
} else {
  // Root route (dev only)
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'RecuirtPro API',
      version: '1.0.0',
      documentation: '/api-docs',
    });
  });
}

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
