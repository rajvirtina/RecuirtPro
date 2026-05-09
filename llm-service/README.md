# RecruitPro LLM Service

Enterprise-grade HR AI Decision Engine for Interview Automation

## Overview

This microservice provides AI-powered interview automation capabilities for the RecruitPro recruitment platform.

### Core Features

1. **Interview Scheduling Intelligence**
   - Automatic optimal slot matching
   - Professional invitation generation
   - Multi-timezone support

2. **Interview Feedback Analysis**
   - Unstructured feedback parsing
   - Objective competency scoring
   - Hiring recommendation with confidence levels

3. **Candidate Communication**
   - GDPR-compliant message generation
   - Tone-appropriate for offer/hold/reject scenarios
   - Internal score protection

## Architecture

```
API Gateway (Backend Node.js)
    ↓
LLM Service (FastAPI - Port 8001)
    ↓
OpenAI / Azure OpenAI / Local LLM
```

## Quick Start

### Prerequisites

- Python 3.10+
- OpenAI API Key
- (Optional) Docker

### Local Development

1. **Install Dependencies**

```bash
cd llm-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Configure Environment**

```bash
cp .env.example .env
# Edit .env with your OpenAI API key
```

3. **Run Service**

```bash
uvicorn app:app --reload --port 8001
```

4. **Access API Docs**

- Swagger UI: http://localhost:8001/api/docs
- ReDoc: http://localhost:8001/api/redoc

### Docker Deployment

```bash
docker build -t recruitpro-llm-service .
docker run -p 8001:8001 --env-file .env recruitpro-llm-service
```

## API Endpoints

### 1. Schedule Interview

**POST** `/api/schedule-interview`

```json
{
  "hr_availability": ["2026-01-20T10:00:00Z", "2026-01-20T14:00:00Z"],
  "candidate_availability": ["2026-01-20T10:00:00Z", "2026-01-21T09:00:00Z"],
  "interview_type": "Technical",
  "duration_minutes": 60
}
```

**Response:**
```json
{
  "success": true,
  "selected_slot": "2026-01-20T10:00:00Z",
  "email_subject": "Interview Invitation - Technical Round",
  "email_body": "Professional email content..."
}
```

### 2. Analyze Feedback

**POST** `/api/analyze-feedback`

```json
{
  "role": "Senior Backend Engineer",
  "interview_type": "Technical Round",
  "raw_feedback": "Candidate showed strong Python skills..."
}
```

**Response:**
```json
{
  "success": true,
  "technical_skills": 8,
  "communication": 7,
  "problem_solving": 9,
  "strengths": ["Strong algorithm knowledge", "Clear communication"],
  "weaknesses": ["System design needs work"],
  "final_recommendation": "Hire",
  "confidence_level": "High"
}
```

### 3. Generate Candidate Message

**POST** `/api/candidate-message`

```json
{
  "evaluation_summary": "Strong technical skills...",
  "outcome": "offer",
  "candidate_name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "candidate_message": "Dear John Doe,\n\nWe are pleased to inform you..."
}
```

## Authentication

All endpoints require API key authentication via header:

```
X-API-Key: your-secret-key
```

Set `API_SECRET_KEY` in your environment.

## Integration with RecruitPro Backend

### Node.js/TypeScript Integration

```typescript
import axios from 'axios';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8001';
const LLM_API_KEY = process.env.LLM_API_KEY;

export async function scheduleInterview(data: ScheduleRequest) {
  const response = await axios.post(
    `${LLM_SERVICE_URL}/api/schedule-interview`,
    data,
    {
      headers: {
        'X-API-Key': LLM_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_MODEL` | Model to use | `gpt-4o-mini` |
| `API_SECRET_KEY` | Service authentication | `default-secret-key` |
| `ALLOWED_ORIGINS` | CORS origins | `http://localhost:3000` |
| `SERVICE_PORT` | Service port | `8001` |

## Production Considerations

### Security

- Use strong `API_SECRET_KEY`
- Rotate OpenAI API keys regularly
- Enable rate limiting at API gateway
- Use HTTPS in production

### Performance

- Use connection pooling
- Cache LLM responses when appropriate
- Monitor token usage and costs
- Scale horizontally with multiple instances

### Monitoring

```bash
# Health check
curl http://localhost:8001/health

# Service info
curl http://localhost:8001/
```

## Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app tests/
```

## Troubleshooting

### OpenAI Authentication Error

- Verify `OPENAI_API_KEY` is set correctly
- Check API key has sufficient credits
- Verify network connectivity to OpenAI

### Rate Limit Error

- Implement exponential backoff
- Use lower tier model (gpt-3.5-turbo)
- Contact OpenAI for limit increase

## Future Enhancements

- [ ] Azure OpenAI integration
- [ ] Local LLM support (Ollama, Llama)
- [ ] Multi-language support
- [ ] Resume parsing
- [ ] Question generation
- [ ] Interview transcript analysis

## License

Proprietary - RecruitPro Platform

## Support

For issues or questions, contact the RecruitPro development team.
