# RecuirtPro - Recruitment Automation Platform

## Overview
End-to-end recruitment automation platform integrating with Microsoft Teams, Google Meet, Zoho, and Naukri, Linkedin, Github for streamlined hiring workflows.

## Features
- **Job Management**: Create, post, and manage job descriptions across multiple portals
- **Candidate Sourcing**: Automated resume collection and intelligent filtering
- **Interview Scheduling**: Integrated calendar management with Teams/Google/Zoho
- **Proctoring System**: Candidate monitoring with consent-based tracking
- **Dashboards**: Comprehensive analytics for HR and candidates
- **Multi-tenant**: Support for multiple companies
- **Role-based Access**: Admin, HR, Interviewer, Candidate, Employer roles

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, MongoDB
- **Frontend**: React, TypeScript, Tailwind CSS
- **LLM Service**: Python, FastAPI, OpenAI (Interview AI Automation)
- **Authentication**: JWT with RBAC
- **API Documentation**: Swagger/OpenAPI
- **Integrations**: Microsoft Graph, Google Calendar, Zoho, Naukri

## Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB >= 6.0
- Git

## Quick Start

### 1. Clone the repository
```bash
git clone <repository-url>
cd RecuirtPro
```

### 2. Install dependencies
```bash
npm run install:all
```

### 3. Configure environment variables

#### Backend (.env in backend folder)
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/recruitpro
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@recruitpro.com

# SMS Gateway
SMS_API_KEY=your-sms-api-key
SMS_SENDER_ID=RECRUIT

# File Storage
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=recruitpro-uploads

# Microsoft Graph
MS_CLIENT_ID=your-client-id
MS_CLIENT_SECRET=your-client-secret
MS_TENANT_ID=your-tenant-id

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Zoho
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret

# Naukri
NAUKRI_API_KEY=your-naukri-api-key
NAUKRI_API_SECRET=your-naukri-secret

# Feature Flags
ENABLE_PROCTORING=true
ENABLE_NAUKRI_INTEGRATION=true
ENABLE_MFA=true

# LLM Service
LLM_SERVICE_URL=http://localhost:8001
LLM_API_KEY=your-secure-secret-key-here
```

#### Frontend (.env in frontend folder)
```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
VITE_ENABLE_PROCTORING=true
```

#### LLM Service (.env in llm-service folder)
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
API_SECRET_KEY=your-secure-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5000
SERVICE_PORT=8001
```

### 4. Start MongoDB
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or use local installation
mongod --dbpath ./data
```

### 5. Run the application
```bash
# Development mode (both frontend and backend)
npm run dev

# Or run separately
npm run dev:backend  # Backend on http://localhost:5000
npm run dev:frontend # Frontend on http://localhost:3000
```

### 6. Access the application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- API Documentation: http://localhost:5000/api-docs

## Project Structure
```
RecuirtPro/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   ├── types/          # TypeScript types
│   │   └── app.ts          # Express app
│   ├── tests/              # Backend tests
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   ├── store/          # State management
│   │   ├── utils/          # Utility functions
│   │   ├── types/          # TypeScript types
│   │   └── App.tsx         # Main app component
│   ├── public/             # Static files
│   └── package.json
├── docs/                   # Documentation
└── package.json            # Root package.json
```

## Development

### Running Tests
```bash
npm run test           # Run all tests
npm run test:backend   # Backend tests only
npm run test:frontend  # Frontend tests only
```

### Linting
```bash
npm run lint           # Lint all
npm run lint:backend   # Lint backend
npm run lint:frontend  # Lint frontend
```

### Building for Production
```bash
npm run build          # Build both
npm run build:backend  # Build backend only
npm run build:frontend # Build frontend only
```

### Starting Production Server
```bash
npm start
```

## Default Users
After initial setup, you can create an admin user:
```bash
cd backend
npm run seed:admin
```

Default credentials:
- Email: admin@recruitpro.com
- Password: Admin@123 (change immediately)

## API Documentation
Interactive API documentation is available at `/api-docs` when the backend is running.

## Deployment
See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed deployment instructions.

## Security
- All endpoints use HTTPS in production
- JWT tokens with refresh mechanism
- Rate limiting on all endpoints
- Input validation and sanitization
- RBAC for all protected routes
- Encrypted storage for sensitive data
- Regular security audits

## Compliance
- GDPR/CCPA compliant data handling
- Explicit consent for candidate monitoring
- Data retention policies
- Right to be forgotten implementation
- Audit logs for all critical operations

## Contributing
See [CONTRIBUTING.md](./docs/CONTRIBUTING.md)

## License
Proprietary - All rights reserved

## Support
For support, email support@recruitpro.com

## Changelog
See [CHANGELOG.md](./docs/CHANGELOG.md)
