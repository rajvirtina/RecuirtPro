"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const cookie_parser_1 = __importDefault(require("cookie-parser")); // BUG-001: httpOnly cookie support
const config_1 = __importDefault(require("./config"));
const middleware_1 = require("./middleware");
const logger_1 = require("./utils/logger");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const jobs_1 = __importDefault(require("./routes/jobs"));
const applications_1 = __importDefault(require("./routes/applications"));
const interviews_1 = __importDefault(require("./routes/interviews"));
const proctoring_1 = __importDefault(require("./routes/proctoring"));
const calendar_1 = __importDefault(require("./routes/calendar"));
const questions_1 = __importDefault(require("./routes/questions"));
const sourcing_1 = __importDefault(require("./routes/sourcing"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const admin_1 = __importDefault(require("./routes/admin"));
const offers_1 = __importDefault(require("./routes/offers"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const hr_1 = __importDefault(require("./routes/hr"));
const gdprRoutes_1 = __importDefault(require("./routes/gdprRoutes"));
const invitations_1 = __importDefault(require("./routes/invitations"));
// import userRoutes from './routes/user';
// ... other routes
const app = (0, express_1.default)();
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
                url: `http://localhost:${config_1.default.port}`,
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
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
// Middleware
// Trust proxy in production (Hostinger/Nginx reverse proxy)
if (config_1.default.env === 'production') {
    app.set('trust proxy', 1);
}
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)()); // BUG-001: parse httpOnly cookies
// SEC-12: Protect uploads behind authentication instead of serving publicly.
// Resumes are served via the /api/v1/applications/:id/resume endpoint which
// performs authorization checks. Static serving is restricted to non-resume
// assets only in development; in production, use S3 signed URLs.
if (config_1.default.env === 'development') {
    app.use('/uploads', express_1.default.static('uploads'));
}
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        // In development, allow all origins
        if (config_1.default.env === 'development') {
            return callback(null, true);
        }
        // In production, check against whitelist
        if (config_1.default.corsOrigin.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((0, express_mongo_sanitize_1.default)());
app.use(middleware_1.xssSanitize);
app.use((0, compression_1.default)());
// Rate limiting
app.use('/api', middleware_1.limiter);
// Morgan HTTP logger
if (config_1.default.env !== 'test') {
    const morgan = require('morgan');
    app.use(morgan('combined', { stream: logger_1.stream }));
}
// API Documentation — SEC-10: Protect Swagger UI in production
if (config_1.default.env !== 'production') {
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
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
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/jobs', jobs_1.default);
app.use('/api/v1/applications', applications_1.default);
app.use('/api/v1/interviews', interviews_1.default);
app.use('/api/v1/proctoring', proctoring_1.default);
app.use('/api/v1/calendar', calendar_1.default);
app.use('/api/v1/questions', questions_1.default);
app.use('/api/v1/sourcing', sourcing_1.default);
app.use('/api/v1/dashboard', dashboard_1.default);
app.use('/api/v1/admin', admin_1.default);
app.use('/api/v1/hr', hr_1.default);
app.use('/api/v1/gdpr', gdprRoutes_1.default);
app.use('/api/v1/invitations', invitations_1.default);
app.use('/api/v1/offers', offers_1.default);
app.use('/api/v1/notifications', notifications_1.default);
// app.use('/api/v1/users', userRoutes);
// app.use('/api/v1/reports', reportRoutes);
// Serve frontend in production
if (config_1.default.env === 'production') {
    const fs = require('fs');
    // Primary: backend/public/ (co-located, works on Hostinger with root=backend)
    // Fallback: ../../frontend/dist (monorepo structure)
    const candidates = [
        path_1.default.join(__dirname, '../public'),
        path_1.default.join(__dirname, '../../public'),
        path_1.default.join(__dirname, '../../frontend/dist'),
        path_1.default.join(__dirname, '../../../frontend/dist'),
    ];
    const frontendDist = candidates.find(p => fs.existsSync(path_1.default.join(p, 'index.html')));
    if (frontendDist) {
        const indexPath = path_1.default.join(frontendDist, 'index.html');
        console.log(`Frontend found at: ${frontendDist}`);
        app.use(express_1.default.static(frontendDist));
        app.get('*', (_req, res) => res.sendFile(indexPath));
    }
    else {
        console.warn(`Frontend not found. __dirname: ${__dirname}`);
        app.get('/', (_req, res) => {
            res.json({ success: true, message: 'RecuirtPro API', version: '1.0.0', note: 'Frontend not found' });
        });
    }
}
else {
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
app.use(middleware_1.notFound);
app.use(middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map