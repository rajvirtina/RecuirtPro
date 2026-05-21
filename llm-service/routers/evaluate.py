"""
AI Interview Evaluation Router
Endpoints for AI-conducted interview question generation and real-time response evaluation.
"""

import os
import re
import json
import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field, validator
import openai

logger = logging.getLogger(__name__)

# Read config from env (same vars as parent app.py)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default-secret-key")

if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

router = APIRouter()

# ─── Security ────────────────────────────────────────────────────────────────

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


def _sanitize(text: str) -> str:
    sanitized = text
    for pattern in INJECTION_PATTERNS:
        sanitized = re.sub(pattern, "[FILTERED]", sanitized)
    return sanitized[:4000]


async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_api_key


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _call_llm(prompt: str, temperature: float = 0.2, max_tokens: int = 1200) -> str:
    """Call OpenAI. Raises ValueError (not HTTPException) so callers can fallback."""
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not configured")
    response = openai.ChatCompletion.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert technical interviewer for a recruitment platform. "
                    "You generate structured, role-specific interview questions and evaluate "
                    "candidate responses objectively. Always return valid JSON only."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message["content"]


def _parse_json(text: str, fallback: dict) -> dict:
    """Extract JSON from LLM output — handles markdown fences and prose wrappers."""
    cleaned = text.strip()
    # Strip ```json ... ``` fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try finding the first {...} block
        m = re.search(r"\{[\s\S]*\}", cleaned)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    logger.warning("JSON parse failed — using fallback")
    return fallback


# ─── Models ──────────────────────────────────────────────────────────────────

class GenerateQuestionsRequest(BaseModel):
    job_title: str        = Field(..., max_length=200)
    job_description: str  = Field(..., max_length=3000)
    required_skills: List[str] = Field(..., max_items=30)
    interview_round: str  = Field(..., description="L1|L2|L3|HR|technical|managerial")
    difficulty: str       = Field("senior", description="junior|senior|expert")
    num_questions: int    = Field(7, ge=3, le=12)

    @validator("interview_round")
    def valid_round(cls, v):
        allowed = {"L1", "L2", "L3", "HR", "technical", "managerial"}
        if v not in allowed:
            raise ValueError(f"interview_round must be one of {allowed}")
        return v

    @validator("difficulty")
    def valid_difficulty(cls, v):
        if v not in {"junior", "senior", "expert"}:
            raise ValueError("difficulty must be junior, senior, or expert")
        return v


class GeneratedQuestion(BaseModel):
    id: str
    text: str
    type: str                    # technical | behavioral | situational | hr
    expected_duration_seconds: int
    order_index: int


class GenerateQuestionsResponse(BaseModel):
    success: bool
    questions: List[GeneratedQuestion] = []
    session_topic: str = ""
    error: Optional[str] = None


class EvaluateResponseRequest(BaseModel):
    job_title: str       = Field(..., max_length=200)
    required_skills: List[str] = Field(..., max_items=30)
    question: str        = Field(..., max_length=1000)
    question_type: str   = Field(..., description="technical|behavioral|situational|hr")
    response_text: str   = Field(..., max_length=3000)
    response_time_seconds: int = Field(0, ge=0, le=3600)


class EvaluateResponseResponse(BaseModel):
    success: bool
    technical_accuracy: int  = 5   # 1-10
    communication_clarity: int = 5  # 1-10
    confidence: int          = 5   # 1-10
    overall_score: int       = 5   # 1-10
    feedback: str            = ""
    improvement_tip: str     = ""
    passed: bool             = True
    error: Optional[str]     = None


# ─── Fallbacks ────────────────────────────────────────────────────────────────

def _fallback_questions(job_title: str, num: int) -> List[dict]:
    pool = [
        {"text": f"Tell me about your experience relevant to the {job_title} role.", "type": "behavioral", "dur": 150},
        {"text": "Describe a technically challenging project you've worked on. What was your role?", "type": "technical", "dur": 180},
        {"text": "How do you approach debugging a production issue you've never seen before?", "type": "situational", "dur": 150},
        {"text": "Walk me through your understanding of scalable system design.", "type": "technical", "dur": 210},
        {"text": "Tell me about a time you disagreed with a teammate. How did you resolve it?", "type": "behavioral", "dur": 120},
        {"text": "How do you prioritise tasks when working under tight deadlines?", "type": "situational", "dur": 120},
        {"text": "What are your core technical strengths, and how do they apply to this role?", "type": "technical", "dur": 150},
        {"text": "Where do you see yourself growing in the next two to three years?", "type": "hr", "dur": 90},
        {"text": "How do you keep your technical skills up to date?", "type": "behavioral", "dur": 90},
        {"text": "Describe a situation where you had to learn something quickly to complete a project.", "type": "situational", "dur": 120},
    ]
    selected = pool[:num]
    return [
        {
            "id": f"fq{i+1}",
            "text": q["text"],
            "type": q["type"],
            "expected_duration_seconds": q["dur"],
            "order_index": i + 1,
        }
        for i, q in enumerate(selected)
    ]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/api/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions(
    req: GenerateQuestionsRequest,
    api_key: str = Depends(verify_api_key),
):
    """
    Generate a tailored set of interview questions for an AI-conducted interview.
    Falls back to a generic question bank if the LLM is unavailable.
    """
    safe_title  = _sanitize(req.job_title)
    safe_desc   = _sanitize(req.job_description)
    safe_skills = _sanitize(", ".join(req.required_skills))

    # Type distribution by round
    type_mix = {
        "L1":         "technical 40%, behavioral 30%, situational 20%, hr 10%",
        "L2":         "technical 50%, behavioral 25%, situational 25%",
        "L3":         "technical 30%, system_design 30%, behavioral 25%, situational 15%",
        "HR":         "behavioral 40%, hr 35%, situational 25%",
        "technical":  "technical 55%, situational 25%, behavioral 20%",
        "managerial": "behavioral 40%, situational 35%, hr 25%",
    }.get(req.interview_round, "technical 40%, behavioral 30%, situational 20%, hr 10%")

    prompt = f"""Create {req.num_questions} interview questions for a {req.difficulty}-level {safe_title} interview.

Job Description (summary): {safe_desc[:800]}
Required Skills: {safe_skills}
Interview Round: {req.interview_round}
Question mix: {type_mix}

Rules:
- Questions must be specific to the role and skills listed
- Difficulty must match "{req.difficulty}" level
- Each question should require 2-4 minutes to answer
- No trick questions; focus on real-world scenarios
- Question types allowed: technical, behavioral, situational, hr

Return ONLY valid JSON — no markdown, no extra text:
{{
  "session_topic": "one-sentence summary of what this interview focuses on",
  "questions": [
    {{
      "id": "q1",
      "text": "full question text",
      "type": "technical|behavioral|situational|hr",
      "expected_duration_seconds": 150,
      "order_index": 1
    }}
  ]
}}"""

    fallback_qs = _fallback_questions(safe_title, req.num_questions)
    fallback = {
        "session_topic": f"{req.interview_round} interview for {safe_title}",
        "questions": fallback_qs,
    }

    try:
        raw = _call_llm(prompt, temperature=0.4, max_tokens=1400)
        parsed = _parse_json(raw, fallback)

        raw_qs = parsed.get("questions", [])
        if not raw_qs:
            raw_qs = fallback_qs

        questions = []
        for i, q in enumerate(raw_qs):
            questions.append(
                GeneratedQuestion(
                    id=q.get("id") or f"q{i+1}",
                    text=q.get("text", "Tell me about yourself."),
                    type=q.get("type", "behavioral"),
                    expected_duration_seconds=int(q.get("expected_duration_seconds", 150)),
                    order_index=int(q.get("order_index", i + 1)),
                )
            )

        return GenerateQuestionsResponse(
            success=True,
            questions=questions,
            session_topic=parsed.get("session_topic", fallback["session_topic"]),
        )

    except Exception as e:
        logger.warning(f"LLM question generation failed — using fallback: {e}")
        return GenerateQuestionsResponse(
            success=True,
            questions=[GeneratedQuestion(**q) for q in fallback_qs],
            session_topic=fallback["session_topic"],
        )


@router.post("/api/evaluate-response", response_model=EvaluateResponseResponse)
async def evaluate_response(
    req: EvaluateResponseRequest,
    api_key: str = Depends(verify_api_key),
):
    """
    Evaluate a candidate's answer to an interview question.
    Returns per-dimension scores (1-10) and actionable feedback.
    Falls back to neutral scores if the LLM is unavailable.
    """
    safe_title    = _sanitize(req.job_title)
    safe_question = _sanitize(req.question)
    safe_response = _sanitize(req.response_text)
    safe_skills   = _sanitize(", ".join(req.required_skills))

    # Contextual hint about response speed
    timing_note = ""
    if req.response_time_seconds < 15:
        timing_note = "Note: The candidate responded very quickly (under 15 seconds) — this may indicate a prepared or very concise answer."
    elif req.response_time_seconds > 300:
        timing_note = "Note: The candidate took over 5 minutes — consider whether they were thorough or struggled to articulate."

    prompt = f"""Evaluate this candidate's interview response objectively.

Role: {safe_title}
Key Skills Required: {safe_skills}
Question Type: {req.question_type}
Question: {safe_question}

Candidate's Response:
\"\"\"{safe_response}\"\"\"
{timing_note}

Score each dimension 1-10 using these criteria:
- technical_accuracy: Correctness and depth of technical content
- communication_clarity: Structure, clarity, and articulation
- confidence: Demonstrates conviction and knowledge, not hesitancy
- overall_score: Holistic assessment (not a simple average)

Passing threshold: overall_score >= 6

Return ONLY valid JSON — no markdown, no extra text:
{{
  "technical_accuracy": <1-10>,
  "communication_clarity": <1-10>,
  "confidence": <1-10>,
  "overall_score": <1-10>,
  "feedback": "one sentence of positive reinforcement (what they did well)",
  "improvement_tip": "one specific, actionable improvement suggestion",
  "passed": <true|false>
}}"""

    fallback = {
        "technical_accuracy":   5,
        "communication_clarity": 5,
        "confidence":            5,
        "overall_score":         5,
        "feedback":              "Thank you for sharing your response.",
        "improvement_tip":       "Try to support your answer with specific examples from past experience.",
        "passed":                True,
    }

    try:
        raw = _call_llm(prompt, temperature=0.1, max_tokens=400)
        parsed = _parse_json(raw, fallback)

        def clamp(v, default=5):
            try:
                return max(1, min(10, int(v)))
            except (TypeError, ValueError):
                return default

        ta  = clamp(parsed.get("technical_accuracy"))
        cc  = clamp(parsed.get("communication_clarity"))
        con = clamp(parsed.get("confidence"))
        ov  = clamp(parsed.get("overall_score"))

        return EvaluateResponseResponse(
            success=True,
            technical_accuracy=ta,
            communication_clarity=cc,
            confidence=con,
            overall_score=ov,
            feedback=str(parsed.get("feedback", fallback["feedback"]))[:500],
            improvement_tip=str(parsed.get("improvement_tip", fallback["improvement_tip"]))[:500],
            passed=bool(parsed.get("passed", ov >= 6)),
        )

    except Exception as e:
        logger.warning(f"LLM response evaluation failed — using fallback: {e}")
        return EvaluateResponseResponse(success=True, **fallback, error=str(e))
