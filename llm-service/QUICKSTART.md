# RecruitPro LLM Service - Quick Setup Guide

## What is this?

This is an **AI-powered microservice** that adds intelligent automation to RecruitPro's interview process:

1. **Smart Interview Scheduling** - Automatically finds optimal meeting times
2. **Feedback Analysis** - Converts unstructured notes into structured evaluations
3. **Candidate Communication** - Generates professional, GDPR-compliant messages

---

## 🚀 Quick Start (5 minutes)

### Prerequisites

- Python 3.10+
- OpenAI API Key ([Get one here](https://platform.openai.com/api-keys))

### Step 1: Setup Environment

```bash
cd llm-service
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-key-here
API_SECRET_KEY=my-secure-key-123
```

### Step 2: Install Dependencies

**Windows:**
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Start Service

**Windows:**
```powershell
.\start.ps1
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

Or manually:
```bash
uvicorn app:app --reload --port 8001
```

### Step 4: Verify Setup

Open browser: http://localhost:8001/api/docs

You should see interactive API documentation (Swagger UI).

---

## 🐳 Docker Quick Start

**Easiest way:**

```bash
# From project root
docker-compose up llm-service
```

**Or standalone:**

```bash
cd llm-service
docker build -t recruitpro-llm .
docker run -p 8001:8001 --env-file .env recruitpro-llm
```

---

## 🧪 Testing

### Health Check

```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-18T...",
  "llm_configured": true
}
```

### Test Interview Scheduling

```bash
curl -X POST http://localhost:8001/api/schedule-interview \
  -H "X-API-Key: my-secure-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "hr_availability": ["2026-01-20T10:00:00Z", "2026-01-20T14:00:00Z"],
    "candidate_availability": ["2026-01-20T10:00:00Z", "2026-01-21T09:00:00Z"],
    "interview_type": "Technical",
    "duration_minutes": 60
  }'
```

### Run Automated Tests

```bash
pytest
```

---

## 📚 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Service info |
| `GET /health` | Health check |
| `POST /api/schedule-interview` | AI-powered scheduling |
| `POST /api/analyze-feedback` | Feedback analysis |
| `POST /api/candidate-message` | Message generation |
| `GET /api/docs` | Interactive API docs |

**Full API documentation:** http://localhost:8001/api/docs

---

## 🔗 Integration with RecruitPro Backend

### Node.js/TypeScript Example

```typescript
import axios from 'axios';

const LLM_SERVICE = 'http://localhost:8001';
const API_KEY = 'my-secure-key-123';

async function scheduleInterview(data) {
  const response = await axios.post(
    `${LLM_SERVICE}/api/schedule-interview`,
    data,
    {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}
```

**See full integration examples:**
- [llm-service/integration-examples/llmServiceClient.ts](./integration-examples/llmServiceClient.ts)
- [llm-service/INTEGRATION.md](./INTEGRATION.md)

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | **Required** |
| `OPENAI_MODEL` | Model to use | `gpt-4o-mini` |
| `API_SECRET_KEY` | Service auth key | `default-secret-key` |
| `SERVICE_PORT` | Port to run on | `8001` |
| `ALLOWED_ORIGINS` | CORS origins | `http://localhost:3000` |

### Cost Optimization

**Default model:** `gpt-4o-mini` (~$0.15 per 1M input tokens)

For cheaper operations, you can use `gpt-3.5-turbo` in `.env`:
```bash
OPENAI_MODEL=gpt-3.5-turbo
```

---

## 🛠️ Troubleshooting

### Issue: "OPENAI_API_KEY not set"

**Solution:** Add your API key to `.env`:
```bash
OPENAI_API_KEY=sk-your-key-here
```

### Issue: "Port 8001 already in use"

**Solution:** Change port in `.env`:
```bash
SERVICE_PORT=8002
```

Then start with:
```bash
uvicorn app:app --port 8002
```

### Issue: "401 Unauthorized"

**Solution:** Make sure you're sending the API key:
```bash
-H "X-API-Key: your-api-secret-key"
```

### Issue: OpenAI API errors

Check your API key is valid and has credits:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key"
```

---

## 📊 Monitoring

### View Logs

```bash
# If running locally
# Logs appear in console

# If running in Docker
docker-compose logs -f llm-service
```

### Token Usage

All LLM calls log token usage:
```
INFO - LLM call successful. Tokens used: 432
```

---

## 🔒 Security

1. **Never commit `.env` to git**
2. **Use strong `API_SECRET_KEY`** (generate with: `openssl rand -hex 32`)
3. **Rotate OpenAI API keys regularly**
4. **Keep the service internal** (not public-facing)
5. **Rate limit at API gateway level**

---

## 📖 Further Reading

- [Full Integration Guide](./INTEGRATION.md)
- [API Documentation](http://localhost:8001/api/docs)
- [Main README](./README.md)
- [OpenAI API Docs](https://platform.openai.com/docs)

---

## 💡 Tips

1. **Start simple:** Test with `/health` endpoint first
2. **Use API docs:** Interactive Swagger UI at `/api/docs`
3. **Monitor costs:** Track token usage in logs
4. **Cache responses:** Implement caching for repeated queries
5. **Error handling:** Always wrap LLM calls in try-catch

---

## 🎯 Next Steps

1. ✅ Get service running locally
2. ✅ Test with Swagger UI
3. ✅ Integrate with backend (see [INTEGRATION.md](./INTEGRATION.md))
4. ✅ Deploy with Docker Compose
5. ✅ Set up monitoring and alerts

---

## ❓ Support

- **Issues:** Check logs first
- **API Errors:** See troubleshooting section
- **Integration Help:** See [INTEGRATION.md](./INTEGRATION.md)
- **OpenAI Issues:** Check [OpenAI Status](https://status.openai.com/)

---

**Happy Coding! 🚀**
