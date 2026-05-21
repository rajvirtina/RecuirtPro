"""
Resume Parsing & Candidate Ranking Router
Two endpoints used by the backend resume-parsing pipeline.
"""

import os
import re
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field, validator
import openai

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default-secret-key")

if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

router = APIRouter()

# ─── Security ─────────────────────────────────────────────────────────────────

INJECTION_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?previous\s+instructions",
    r"(?i)you\s+are\s+now\s+a",
    r"(?i)disregard\s+(all\s+)?(above|prior|previous)",
    r"(?i)system\s*:\s*",
    r"(?i)act\s+as\s+(if\s+you\s+are\s+)?a",
    r"(?i)pretend\s+to\s+be",
    r"(?i)new\s+instructions?\s*:",
    r"(?i)override\s+(all\s+)?rules",
]


def _sanitize(text: str) -> str:
    sanitized = text
    for p in INJECTION_PATTERNS:
        sanitized = re.sub(p, "[FILTERED]", sanitized)
    return sanitized[:5000]


async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_api_key


# ─── JSON helpers ──────────────────────────────────────────────────────────────

def _call_llm(prompt: str, temperature: float = 0.1, max_tokens: int = 800) -> str:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not configured")
    response = openai.ChatCompletion.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a precision resume parser and candidate ranking system. "
                    "Always return valid JSON only. No markdown, no explanation, no code fences."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message["content"]


def _parse_json(raw: str, fallback: dict) -> dict:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", cleaned)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    logger.warning("JSON parse failed — using fallback")
    return fallback


# ─── Models ───────────────────────────────────────────────────────────────────

class ParseResumeRequest(BaseModel):
    resume_text: str = Field(..., min_length=10, max_length=15000)


class EducationEntry(BaseModel):
    degree: str
    institution: str


class ParseResumeResponse(BaseModel):
    success: bool = True
    skills: List[str] = []
    years_experience: Optional[float] = None
    education: List[EducationEntry] = []
    notice_period: Optional[str] = None
    error: Optional[str] = None


class RankCandidateRequest(BaseModel):
    job_description: str = Field(..., max_length=4000)
    resume_text:     str = Field(..., max_length=4000)
    required_skills: List[str] = Field(default_factory=list, max_items=50)


class RankCandidateResponse(BaseModel):
    success: bool = True
    skill_match_pct: int   = 50   # 0-100
    experience_fit:  int   = 50
    overall_fit:     int   = 50
    missing_skills:  List[str] = []
    matching_skills: List[str] = []
    error: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/api/parse-resume", response_model=ParseResumeResponse)
async def parse_resume(
    req: ParseResumeRequest,
    api_key: str = Depends(verify_api_key),
):
    """
    Extract structured information from raw resume text.
    Returns skills, experience years, education, and notice period.
    Falls back to empty defaults if LLM is unavailable.
    """
    safe_text = _sanitize(req.resume_text)

    fallback = {
        "skills": [],
        "years_experience": None,
        "education": [],
        "notice_period": None,
    }

    prompt = f"""Extract information from this resume text. Return ONLY valid JSON — no markdown, no explanation.

Required JSON format (use null for missing values):
{{
  "skills": ["Python", "Docker", "React", ...],
  "years_experience": 5,
  "education": [
    {{"degree": "B.Tech Computer Science", "institution": "IIT Delhi"}},
    ...
  ],
  "notice_period": "30 days"
}}

Rules:
- skills: only technical and professional skills (deduplicate, normalise casing)
- years_experience: total years of work experience as a number (null if unclear)
- education: include all degrees/certifications found
- notice_period: immediate / X days / X months / currently serving / null

Resume text:
\"\"\"{safe_text}\"\"\"
"""

    try:
        raw = _call_llm(prompt, temperature=0.05, max_tokens=900)
        parsed = _parse_json(raw, fallback)

        skills = [str(s).strip() for s in parsed.get("skills", []) if s][:50]
        edu_raw = parsed.get("education", [])
        education = []
        for e in edu_raw:
            if isinstance(e, dict):
                education.append(
                    EducationEntry(
                        degree=str(e.get("degree", "")).strip(),
                        institution=str(e.get("institution", "")).strip(),
                    )
                )

        yoe = parsed.get("years_experience")
        try:
            yoe = float(yoe) if yoe is not None else None
        except (TypeError, ValueError):
            yoe = None

        return ParseResumeResponse(
            success=True,
            skills=skills,
            years_experience=yoe,
            education=education,
            notice_period=str(parsed.get("notice_period", "") or "").strip() or None,
        )

    except Exception as e:
        logger.warning(f"parse_resume LLM call failed — returning empty data: {e}")
        return ParseResumeResponse(success=True, **fallback, error=str(e))


@router.post("/api/rank-candidate", response_model=RankCandidateResponse)
async def rank_candidate(
    req: RankCandidateRequest,
    api_key: str = Depends(verify_api_key),
):
    """
    Score a candidate's resume against a job description.
    Returns skill_match_pct, experience_fit, overall_fit, and skill gap analysis.
    """
    safe_jd     = _sanitize(req.job_description)
    safe_resume = _sanitize(req.resume_text)
    safe_skills = [_sanitize(s) for s in req.required_skills[:30]]

    fallback = {
        "skill_match_pct": 50,
        "experience_fit":  50,
        "overall_fit":     50,
        "missing_skills":  [],
        "matching_skills": [],
    }

    prompt = f"""You are a senior recruiter scoring a candidate against a job description.
Return ONLY valid JSON — no markdown, no explanation.

Job Description:
\"\"\"{safe_jd}\"\"\"

Required Skills for this role:
{safe_skills}

Candidate Profile / Resume Summary:
\"\"\"{safe_resume}\"\"\"

Score the candidate and return this exact JSON:
{{
  "skill_match_pct": <0-100 integer>,
  "experience_fit": <0-100 integer>,
  "overall_fit": <0-100 integer>,
  "missing_skills": ["skill1", "skill2"],
  "matching_skills": ["skill3", "skill4"]
}}

Scoring rules:
- skill_match_pct: what percentage of required_skills appear in the candidate's profile?
- experience_fit: how well does the candidate's experience level and domain match the role?
- overall_fit: holistic fit score (skills 50%, experience 30%, education/other 20%)
- missing_skills: required skills NOT found in the candidate's profile (limit to 10)
- matching_skills: required skills that ARE found in the candidate's profile (limit to 10)
"""

    try:
        raw    = _call_llm(prompt, temperature=0.05, max_tokens=500)
        parsed = _parse_json(raw, fallback)

        def clamp(v, default=50):
            try:
                return max(0, min(100, int(v)))
            except (TypeError, ValueError):
                return default

        return RankCandidateResponse(
            success=True,
            skill_match_pct=clamp(parsed.get("skill_match_pct")),
            experience_fit= clamp(parsed.get("experience_fit")),
            overall_fit=    clamp(parsed.get("overall_fit")),
            missing_skills= [str(s) for s in parsed.get("missing_skills", [])][:10],
            matching_skills=[str(s) for s in parsed.get("matching_skills", [])][:10],
        )

    except Exception as e:
        logger.warning(f"rank_candidate LLM call failed — using fallback: {e}")
        return RankCandidateResponse(success=True, **fallback, error=str(e))
