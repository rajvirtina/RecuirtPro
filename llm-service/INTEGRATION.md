# RecruitPro LLM Service - Integration Guide

## Overview

This document provides integration instructions for connecting your RecruitPro backend (Node.js/Spring Boot) and frontend (React) to the LLM microservice.

---

## Architecture

```
┌─────────────────┐
│  React Frontend │
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
    ┌────▼─────┐      ┌────▼──────────┐
    │ Backend  │      │  LLM Service  │
    │ (Node.js)│◄─────┤  (FastAPI)    │
    └──────────┘      └───────────────┘
         │
    ┌────▼────┐
    │ MongoDB │
    └─────────┘
```

---

## 1. Backend Integration (Node.js/TypeScript)

### Step 1: Add Environment Variables

Add to your backend `.env`:

```bash
LLM_SERVICE_URL=http://localhost:8001
LLM_API_KEY=your-secure-api-key-here
```

### Step 2: Create Service Client

Copy [llmServiceClient.ts](./integration-examples/llmServiceClient.ts) to your backend services folder:

```bash
backend/src/services/llmServiceClient.ts
```

### Step 3: Use in Your Controllers

Example in [interviewController.ts](../backend/src/controllers/interviewController.ts):

```typescript
import { LLMServiceClient } from '../services/llmServiceClient';

const llmService = new LLMServiceClient();

// Schedule interview
export async function scheduleInterview(req: Request, res: Response) {
  try {
    const result = await llmService.scheduleInterview({
      hr_availability: req.body.hr_availability,
      candidate_availability: req.body.candidate_availability,
      interview_type: req.body.interview_type,
    });

    if (result.success) {
      // Save to database
      await Interview.create({
        scheduled_time: result.selected_slot,
        email_sent: true,
      });

      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// Analyze feedback
export async function submitFeedback(req: Request, res: Response) {
  try {
    const analysis = await llmService.analyzeFeedback({
      role: req.body.role,
      interview_type: req.body.interview_type,
      raw_feedback: req.body.feedback,
    });

    if (analysis.success) {
      // Save analysis to database
      await Interview.findByIdAndUpdate(req.params.id, {
        feedback_analysis: analysis,
        status: analysis.final_recommendation,
      });

      res.json({ success: true, data: analysis });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

---

## 2. Frontend Integration (React/TypeScript)

### Step 1: Add Environment Variables

Add to your frontend `.env`:

```bash
VITE_LLM_SERVICE_URL=http://localhost:8001
VITE_LLM_API_KEY=your-secure-api-key-here
```

### Step 2: Create Service Client

Copy [reactIntegration.tsx](./integration-examples/reactIntegration.tsx) to:

```bash
frontend/src/services/llmService.ts
```

### Step 3: Use in Components

```typescript
import { useInterviewScheduling } from '../services/llmService';

function InterviewSchedulePage() {
  const { scheduleInterview, loading, error, result } = useInterviewScheduling();

  const handleSubmit = async (formData) => {
    try {
      const response = await scheduleInterview({
        hr_availability: formData.hrSlots,
        candidate_availability: formData.candidateSlots,
        interview_type: formData.type,
      });

      if (response.success) {
        toast.success('Interview scheduled successfully!');
      }
    } catch (err) {
      toast.error('Failed to schedule interview');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Your form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Scheduling...' : 'Schedule Interview'}
      </button>
    </form>
  );
}
```

---

## 3. Spring Boot Integration (Java)

### Step 1: Add Configuration

In `application.yml`:

```yaml
llm:
  service:
    url: http://localhost:8001
    api-key: your-secure-api-key-here
```

### Step 2: Add Dependencies

In `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
</dependency>
```

### Step 3: Create Service Client

Copy [LLMServiceClient.java](./integration-examples/LLMServiceClient.java) to:

```bash
src/main/java/com/recruitpro/service/LLMServiceClient.java
```

### Step 4: Use in Controllers

```java
@RestController
@RequestMapping("/api/interviews")
public class InterviewController {

    @Autowired
    private LLMServiceClient llmService;

    @PostMapping("/schedule")
    public ResponseEntity<?> scheduleInterview(@RequestBody ScheduleRequest request) {
        LLMServiceClient.ScheduleResponse response = llmService.scheduleInterview(request);
        
        if (response.isSuccess()) {
            // Save to database
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(500).body(response);
        }
    }
}
```

---

## 4. Docker Compose Integration

The LLM service is already configured in [docker-compose.yml](../docker-compose.yml).

### Start All Services

```bash
# Make sure .env is configured with OPENAI_API_KEY
docker-compose up -d
```

### Service URLs

- LLM Service: http://localhost:8001
- API Docs: http://localhost:8001/api/docs
- Backend: http://localhost:5001
- Frontend: http://localhost:3000

---

## 5. API Testing

### Using cURL

```bash
# Health check
curl http://localhost:8001/health

# Schedule interview
curl -X POST http://localhost:8001/api/schedule-interview \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "hr_availability": ["2026-01-20T10:00:00Z"],
    "candidate_availability": ["2026-01-20T10:00:00Z"],
    "interview_type": "Technical"
  }'

# Analyze feedback
curl -X POST http://localhost:8001/api/analyze-feedback \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "Backend Engineer",
    "interview_type": "Technical",
    "raw_feedback": "Candidate demonstrated strong Python skills and problem-solving ability."
  }'
```

### Using Postman

Import collection from `postman_collection.json` (create if needed).

---

## 6. Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid API key | Check `X-API-Key` header |
| 500 LLM Error | OpenAI API issue | Check `OPENAI_API_KEY` |
| 422 Validation | Invalid request data | Check request schema |
| Timeout | LLM response slow | Increase timeout setting |

### Backend Error Handling

```typescript
try {
  const result = await llmService.scheduleInterview(data);
} catch (error) {
  if (error.message.includes('401')) {
    logger.error('LLM service authentication failed');
  } else if (error.message.includes('timeout')) {
    logger.error('LLM service timeout');
  }
  // Fallback logic
}
```

---

## 7. Security Best Practices

1. **Never expose API keys in frontend**
   - Keep LLM service calls server-side only
   - Frontend should call your backend, which then calls LLM service

2. **Use strong API keys**
   ```bash
   # Generate secure key
   openssl rand -hex 32
   ```

3. **Rate limiting**
   - Implement rate limiting at API gateway
   - Monitor OpenAI usage and costs

4. **Audit logging**
   - Log all LLM service calls
   - Track token usage per request

---

## 8. Monitoring & Observability

### Health Checks

```typescript
// Backend health check
app.get('/health', async (req, res) => {
  const llmHealth = await llmService.healthCheck();
  res.json({
    backend: 'healthy',
    llm_service: llmHealth ? 'healthy' : 'unhealthy',
  });
});
```

### Logging

All LLM service calls are automatically logged with token usage.

---

## 9. Cost Optimization

1. **Use cheaper models for simple tasks**
   - `gpt-3.5-turbo` for scheduling
   - `gpt-4o-mini` for feedback analysis

2. **Cache responses**
   - Cache common scheduling patterns
   - Cache feedback analysis for similar inputs

3. **Set token limits**
   ```python
   max_tokens=500  # Limit response length
   temperature=0.1  # More deterministic = cheaper
   ```

---

## 10. Troubleshooting

### LLM Service Not Starting

```bash
# Check logs
docker-compose logs llm-service

# Check if port is in use
netstat -an | findstr 8001

# Test locally
cd llm-service
python app.py
```

### OpenAI API Errors

```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Connection Refused

- Ensure LLM service is running
- Check firewall rules
- Verify `LLM_SERVICE_URL` is correct

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs llm-service`
2. Review API docs: http://localhost:8001/api/docs
3. Contact DevOps team

---

**Last Updated:** January 2026
