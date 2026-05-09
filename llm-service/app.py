"""
HR – Candidate Bridge Portal (LLM Powered)
RecruitPro AI Microservice

Features:
1. Interview Scheduling Intelligence
2. Interview Feedback Analysis
3. Candidate Communication Generation

Tech Stack:
- Python 3.10+
- FastAPI
- OpenAI / Azure OpenAI / Local LLM
"""

import os
import re
import logging
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
import openai

# =========================
# LOGGING CONFIGURATION
# =========================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =========================
# CONFIGURATION
# =========================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default-secret-key")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
APP_ENV = os.getenv("APP_ENV", "development")

# SEC-14/B-19: Reject default secret key in production
if APP_ENV == "production" and API_SECRET_KEY == "default-secret-key":
    raise RuntimeError("FATAL: API_SECRET_KEY must be set to a secure value in production. Do not use default-secret-key.")

if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY not set. LLM calls will fail.")
else:
    openai.api_key = OPENAI_API_KEY

# =========================
# FASTAPI APP
# =========================
app = FastAPI(
    title="RecruitPro LLM Service",
    description="Enterprise HR AI Decision Engine for Interview Automation",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# SYSTEM PROMPT
# =========================
SYSTEM_PROMPT = """You are an enterprise-grade HR AI service embedded inside a recruitment automation platform (RecruitPro).
You operate as a backend decision engine, not a chatbot.
All outputs must be structured, deterministic, API-friendly, and production safe.

Core Responsibilities:
1. Interview Scheduling Intelligence - Match HR and candidate availability optimally
2. Interview Feedback Analysis - Parse notes, score competencies, recommend objectively
3. Candidate Communication Generation - Convert internal evaluation into external-safe language

Rules:
- Be stateless and deterministic
- Never expose internal scoring to candidates
- Always return valid JSON when requested
- GDPR safe, no bias, no fabrication
- No emojis, no marketing language, no legal promises
- If data is unclear, mark as "Insufficient Data"
- Act like a production microservice, not a chatbot
"""

# =========================
# SECURITY
# =========================

# 4.16: Prompt injection mitigation — strip known injection patterns from user input
INJECTION_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?previous\s+instructions",
    r"(?i)you\s+are\s+now\s+a",
    r"(?i)disregard\s+(all\s+)?(above|prior|previous)",
    r"(?i)system\s*:\s*",
    r"(?i)act\s+as\s+(if\s+you\s+are\s+)?a",
    r"(?i)pretend\s+to\s+be",
    r"(?i)new\s+instructions?\s*:",
    r"(?i)override\s+(all\s+)?rules",
    r"(?i)\[INST\]",
    r"(?i)<\|im_start\|>",
]

def sanitize_llm_input(text: str) -> str:
    """Strip prompt injection patterns from user-provided text."""
    sanitized = text
    for pattern in INJECTION_PATTERNS:
        sanitized = re.sub(pattern, "[FILTERED]", sanitized)
    # Limit total length to prevent token flooding
    return sanitized[:5000]

async def verify_api_key(x_api_key: str = Header(None)):
    """Verify API key for service-to-service authentication"""
    if x_api_key != API_SECRET_KEY:
        logger.warning(f"Invalid API key attempt")
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_api_key

# =========================
# DATA MODELS
# =========================

class ScheduleRequest(BaseModel):
    hr_availability: list[str] = Field(..., description="List of HR available time slots (ISO 8601)")
    candidate_availability: list[str] = Field(..., description="List of candidate available time slots (ISO 8601)")
    interview_type: str = Field(..., description="Type of interview (Technical, HR, Final)")
    duration_minutes: Optional[int] = Field(60, description="Interview duration in minutes")
    
    class Config:
        schema_extra = {
            "example": {
                "hr_availability": ["2026-01-20T10:00:00Z", "2026-01-20T14:00:00Z"],
                "candidate_availability": ["2026-01-20T10:00:00Z", "2026-01-21T09:00:00Z"],
                "interview_type": "Technical",
                "duration_minutes": 60
            }
        }


class FeedbackRequest(BaseModel):
    role: str = Field(..., description="Job role title")
    interview_type: str = Field(..., description="Type of interview conducted")
    raw_feedback: str = Field(..., description="Unstructured interviewer notes")
    
    @validator('raw_feedback')
    def validate_feedback(cls, v):
        if len(v.strip()) < 10:
            raise ValueError('Feedback must be at least 10 characters')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "role": "Senior Backend Engineer",
                "interview_type": "Technical Round",
                "raw_feedback": "Candidate demonstrated strong knowledge of Python and FastAPI. Solved the algorithm problem efficiently. Communication was clear but could improve on system design thinking."
            }
        }


class CandidateMessageRequest(BaseModel):
    evaluation_summary: str = Field(..., description="Internal evaluation summary")
    outcome: str = Field(..., description="Outcome: offer, hold, reject")
    candidate_name: Optional[str] = Field(None, description="Candidate name for personalization")
    
    @validator('outcome')
    def validate_outcome(cls, v):
        if v.lower() not in ['offer', 'hold', 'reject']:
            raise ValueError('Outcome must be offer, hold, or reject')
        return v.lower()
    
    class Config:
        schema_extra = {
            "example": {
                "evaluation_summary": "Strong technical skills, good communication, needs improvement in system design",
                "outcome": "hold",
                "candidate_name": "John Doe"
            }
        }


class ScheduleResponse(BaseModel):
    success: bool
    selected_slot: Optional[str]
    email_subject: Optional[str]
    email_body: Optional[str]
    error: Optional[str] = None


class FeedbackResponse(BaseModel):
    success: bool
    technical_skills: Optional[int] = Field(None, ge=1, le=10)
    communication: Optional[int] = Field(None, ge=1, le=10)
    problem_solving: Optional[int] = Field(None, ge=1, le=10)
    strengths: Optional[list[str]] = None
    weaknesses: Optional[list[str]] = None
    final_recommendation: Optional[str] = None
    confidence_level: Optional[str] = None
    error: Optional[str] = None


class MessageResponse(BaseModel):
    success: bool
    candidate_message: Optional[str] = None
    error: Optional[str] = None


# =========================
# LLM CALL FUNCTION
# =========================

def call_llm(prompt: str, temperature: float = 0.2, max_tokens: int = 1000) -> str:
    """
    Call OpenAI LLM with error handling and retry logic
    """
    try:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")
        
        response = openai.ChatCompletion.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        result = response.choices[0].message["content"]
        logger.info(f"LLM call successful. Tokens used: {response.usage.total_tokens}")
        return result
        
    except openai.error.AuthenticationError:
        logger.error("OpenAI authentication failed")
        raise HTTPException(status_code=500, detail="LLM service authentication failed")
    except openai.error.RateLimitError:
        logger.error("OpenAI rate limit exceeded")
        raise HTTPException(status_code=429, detail="LLM service rate limit exceeded")
    except Exception as e:
        logger.error(f"LLM call failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"LLM service error: {str(e)}")


# =========================
# API ENDPOINTS
# =========================

@app.get("/")
def home():
    """Health check and service info"""
    return {
        "service": "RecruitPro LLM Service",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "features": [
            "Interview Scheduling Intelligence",
            "Interview Feedback Analysis",
            "Candidate Communication Generation"
        ]
    }


@app.get("/health")
def health_check():
    """Kubernetes/Docker health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "llm_configured": bool(OPENAI_API_KEY)
    }


@app.post("/api/schedule-interview", response_model=ScheduleResponse)
def schedule_interview(
    data: ScheduleRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Intelligent interview scheduling - finds optimal slot and generates invitation
    """
    try:
        # 4.16: Sanitize user inputs before prompt interpolation
        safe_hr = [sanitize_llm_input(s) for s in data.hr_availability]
        safe_cand = [sanitize_llm_input(s) for s in data.candidate_availability]
        safe_type = sanitize_llm_input(data.interview_type)

        prompt = f"""
You are an HR coordinator optimizing interview schedules.

HR Availability (ISO 8601):
{safe_hr}

Candidate Availability (ISO 8601):
{safe_cand}

Interview Type: {safe_type}
Duration: {data.duration_minutes} minutes

Tasks:
1. Find the earliest mutual slot that works for both parties
2. Generate a professional interview invitation email

Return ONLY valid JSON (no markdown, no extra text):
{{
  "selected_slot": "ISO 8601 timestamp",
  "email_subject": "Clear and professional subject line",
  "email_body": "Professional invitation with date, time, type, and duration"
}}

If no mutual slot exists, return:
{{
  "selected_slot": null,
  "email_subject": "No Available Slot",
  "email_body": "We're having difficulty finding a mutual time. Please provide additional availability."
}}
"""
        result = call_llm(prompt, temperature=0.1)
        
        # Parse JSON response
        import json
        parsed = json.loads(result.strip().replace('```json', '').replace('```', ''))
        
        return ScheduleResponse(
            success=True,
            selected_slot=parsed.get("selected_slot"),
            email_subject=parsed.get("email_subject"),
            email_body=parsed.get("email_body")
        )
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {str(e)}")
        return ScheduleResponse(success=False, error="Failed to parse scheduling result")
    except Exception as e:
        logger.error(f"Schedule interview error: {str(e)}")
        return ScheduleResponse(success=False, error=str(e))


@app.post("/api/analyze-feedback", response_model=FeedbackResponse)
def analyze_feedback(
    data: FeedbackRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Analyze unstructured interview feedback and provide structured evaluation
    """
    try:
        # 4.16: Sanitize user inputs before prompt interpolation
        safe_role = sanitize_llm_input(data.role)
        safe_type = sanitize_llm_input(data.interview_type)
        safe_feedback = sanitize_llm_input(data.raw_feedback)

        prompt = f"""
You are a senior HR evaluator analyzing interview performance objectively.

Job Role: {safe_role}
Interview Type: {safe_type}

Raw Interview Feedback:
{safe_feedback}

Analyze and return ONLY valid JSON (no markdown, no extra text):
{{
  "technical_skills": <1-10 integer>,
  "communication": <1-10 integer>,
  "problem_solving": <1-10 integer>,
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "final_recommendation": "Hire|Hold|Reject",
  "confidence_level": "High|Medium|Low"
}}

Rules:
- Be objective and evidence-based
- If data is insufficient, use "Insufficient Data" for recommendation
- No bias based on protected attributes
- Scores must be integers 1-10
"""
        result = call_llm(prompt, temperature=0.1)
        
        # Parse JSON response
        import json
        parsed = json.loads(result.strip().replace('```json', '').replace('```', ''))
        
        return FeedbackResponse(
            success=True,
            technical_skills=parsed.get("technical_skills"),
            communication=parsed.get("communication"),
            problem_solving=parsed.get("problem_solving"),
            strengths=parsed.get("strengths", []),
            weaknesses=parsed.get("weaknesses", []),
            final_recommendation=parsed.get("final_recommendation"),
            confidence_level=parsed.get("confidence_level")
        )
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {str(e)}")
        return FeedbackResponse(success=False, error="Failed to parse feedback analysis")
    except Exception as e:
        logger.error(f"Analyze feedback error: {str(e)}")
        return FeedbackResponse(success=False, error=str(e))


@app.post("/api/candidate-message", response_model=MessageResponse)
def generate_candidate_message(
    data: CandidateMessageRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Generate professional, GDPR-safe candidate communication
    """
    try:
        candidate_prefix = f"Dear {sanitize_llm_input(data.candidate_name)},\n\n" if data.candidate_name else "Dear Candidate,\n\n"
        
        # 4.16: Sanitize user inputs before prompt interpolation
        safe_summary = sanitize_llm_input(data.evaluation_summary)
        safe_outcome = sanitize_llm_input(data.outcome)

        prompt = f"""
You are an HR communication specialist generating candidate-facing messages.

Internal Evaluation Summary:
{safe_summary}

Outcome: {safe_outcome}

Generate a professional email body (plain text, no HTML).

Rules:
- DO NOT expose internal scores or detailed weaknesses
- Be respectful, encouraging, and professional
- For "offer": congratulatory but formal
- For "hold": encourage patience, next steps unclear
- For "reject": respectful, encouraging for future opportunities
- No emojis, no marketing language, no legal commitments
- Keep it concise (150-250 words)
- GDPR compliant - no unnecessary personal data

Return only the email body text (no subject line, no JSON).
"""
        result = call_llm(prompt, temperature=0.3, max_tokens=500)
        
        # Prepend candidate name
        full_message = candidate_prefix + result.strip()
        
        return MessageResponse(
            success=True,
            candidate_message=full_message
        )
        
    except Exception as e:
        logger.error(f"Generate candidate message error: {str(e)}")
        return MessageResponse(success=False, error=str(e))


# =========================
# SEMANTIC MATCHING ENDPOINT
# =========================

class SemanticMatchRequest(BaseModel):
    candidate_skills: list[str] = Field(..., description="Candidate's skills list")
    job_requirements: list[str] = Field(..., description="Job requirement skills list")
    candidate_summary: Optional[str] = Field(None, description="Candidate summary/bio")
    job_description: Optional[str] = Field(None, description="Job description text")


class SemanticMatchResponse(BaseModel):
    score: int
    analysis: Optional[str] = None
    success: bool = True
    error: Optional[str] = None


@app.post("/api/semantic-match", response_model=SemanticMatchResponse,
           dependencies=[Depends(verify_api_key)])
async def semantic_match(data: SemanticMatchRequest):
    """
    AI-powered semantic skill matching using LLM embeddings context.
    Returns a 0-100 match score with analysis.
    """
    try:
        safe_candidate = sanitize_llm_input(", ".join(data.candidate_skills))
        safe_requirements = sanitize_llm_input(", ".join(data.job_requirements))
        safe_summary = sanitize_llm_input(data.candidate_summary or "")
        safe_description = sanitize_llm_input(data.job_description or "")

        prompt = f"""You are a technical recruiter AI. Analyze skill match between a candidate and job requirements.

Candidate Skills: {safe_candidate}
{f"Candidate Summary: {safe_summary}" if safe_summary else ""}

Job Requirements: {safe_requirements}
{f"Job Description: {safe_description}" if safe_description else ""}

Evaluate:
1. Direct skill matches (exact technology match)
2. Related/transferable skills (e.g., React experience is relevant for Vue.js roles)
3. Ecosystem familiarity (e.g., knowing Docker suggests container orchestration capability)
4. Skill depth inference from combination of skills

Return ONLY valid JSON:
{{"score": <0-100 integer>, "analysis": "<one paragraph analysis>"}}
"""
        result = call_llm(prompt, temperature=0.1, max_tokens=300)

        # Parse JSON from LLM response
        import json
        try:
            parsed = json.loads(result.strip())
            return SemanticMatchResponse(
                score=max(0, min(100, int(parsed.get("score", 50)))),
                analysis=parsed.get("analysis", ""),
                success=True
            )
        except (json.JSONDecodeError, ValueError):
            # Fallback: keyword overlap
            overlap = sum(1 for s in data.candidate_skills
                         if any(r.lower() in s.lower() or s.lower() in r.lower()
                                for r in data.job_requirements))
            score = round((overlap / max(len(data.job_requirements), 1)) * 100)
            return SemanticMatchResponse(score=score, analysis=result.strip()[:200], success=True)

    except Exception as e:
        logger.error(f"Semantic match error: {str(e)}")
        # Fallback to keyword matching
        overlap = sum(1 for s in data.candidate_skills
                     if any(r.lower() in s.lower() or s.lower() in r.lower()
                            for r in data.job_requirements))
        score = round((overlap / max(len(data.job_requirements), 1)) * 100)
        return SemanticMatchResponse(score=score, success=True, error=str(e))


# =========================
# ERROR HANDLERS
# =========================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    logger.error(f"HTTP error: {exc.detail}")
    return {
        "success": False,
        "error": exc.detail,
        "status_code": exc.status_code
    }


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled error: {str(exc)}")
    return {
        "success": False,
        "error": "Internal server error",
        "status_code": 500
    }


# =========================
# STARTUP
# =========================

@app.on_event("startup")
async def startup_event():
    logger.info("RecruitPro LLM Service starting...")
    logger.info(f"OpenAI Model: {OPENAI_MODEL}")
    logger.info(f"API Key configured: {bool(OPENAI_API_KEY)}")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("RecruitPro LLM Service shutting down...")


# =========================
# RUN COMMAND
# =========================
# uvicorn app:app --host 0.0.0.0 --port 8001 --reload
