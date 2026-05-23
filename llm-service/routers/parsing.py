"""
Resume Parsing & Candidate Ranking Router
Two endpoints used by the backend resume-parsing pipeline.
"""

import os
import re
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field, validator
from openai import OpenAI as _OpenAI

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default-secret-key")

_client: Optional[_OpenAI] = None
if OPENAI_API_KEY:
    _client = _OpenAI(api_key=OPENAI_API_KEY)

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


def _sanitize(text: str, max_len: int = 5000) -> str:
    sanitized = text
    for p in INJECTION_PATTERNS:
        sanitized = re.sub(p, "[FILTERED]", sanitized)
    return sanitized[:max_len]


async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_api_key


# ─── JSON helpers ──────────────────────────────────────────────────────────────

def _call_llm(prompt: str, system: str, temperature: float = 0.1, max_tokens: int = 1200) -> str:
    if not _client:
        raise ValueError("OPENAI_API_KEY not configured")
    response = _client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


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
    degree:      str
    institution: str
    year:        Optional[int] = None


class WorkHistoryEntry(BaseModel):
    company:         str
    role:            str
    duration_months: Optional[int] = None
    highlights:      List[str] = []


class ParseResumeResponse(BaseModel):
    success: bool = True
    # Identity (extracted from resume header)
    full_name:       Optional[str] = None
    email:           Optional[str] = None
    phone:           Optional[str] = None
    current_role:    Optional[str] = None
    current_company: Optional[str] = None
    # Experience summary
    skills:          List[str] = []
    years_experience: Optional[float] = None
    notice_period:   Optional[str] = None
    # Structured history
    education:       List[EducationEntry] = []
    work_history:    List[WorkHistoryEntry] = []
    error:           Optional[str] = None


class RankCandidateRequest(BaseModel):
    job_description:    str = Field(..., max_length=4000)
    required_skills:    List[str] = Field(default_factory=list, max_items=50)
    experience_required: Optional[int] = Field(None, ge=0)   # years
    # Either structured profile OR raw resume text (structured preferred)
    candidate_profile:  Optional[Dict[str, Any]] = None
    resume_text:        Optional[str] = Field(None, max_length=4000)


class RankCandidateResponse(BaseModel):
    success:         bool = True
    skill_match_pct: int  = 50   # 0-100
    experience_fit:  int  = 50
    overall_fit:     int  = 50
    missing_skills:  List[str] = []
    matching_skills: List[str] = []
    fit_summary:     Optional[str] = None   # ≤2 sentences from LLM
    error:           Optional[str] = None


# ─── Endpoint: parse-resume ───────────────────────────────────────────────────

_PARSE_SYSTEM = (
    "You are a precision resume parser. "
    "Extract structured data from resume text and return ONLY valid JSON — "
    "no markdown, no explanation, no code fences."
)

@router.post("/api/parse-resume", response_model=ParseResumeResponse)
async def parse_resume(
    req: ParseResumeRequest,
    api_key: str = Depends(verify_api_key),
):
    """
    Extract structured information from raw resume text.
    Returns identity, skills, experience, education, work history, and notice period.
    Gracefully falls back to empty defaults when LLM is unavailable.
    """
    safe_text = _sanitize(req.resume_text, 5000)

    fallback: dict = {
        "full_name": None, "email": None, "phone": None,
        "current_role": None, "current_company": None,
        "skills": [], "years_experience": None,
        "notice_period": None, "education": [], "work_history": [],
    }

    prompt = f"""Parse this resume. Return ONLY valid JSON — no markdown, no explanation.

Required JSON format (use null for missing values):
{{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+91 9876543210",
  "current_role": "Senior Software Engineer",
  "current_company": "Acme Corp",
  "years_experience": 6.5,
  "notice_period": "30 days",
  "skills": ["python", "docker", "react"],
  "education": [
    {{"degree": "B.Tech Computer Science", "institution": "IIT Delhi", "year": 2018}}
  ],
  "work_history": [
    {{
      "company": "Acme Corp",
      "role": "Senior Software Engineer",
      "duration_months": 24,
      "highlights": ["Led migration to microservices", "Reduced API latency by 40%"]
    }}
  ]
}}

Extraction rules:
- full_name: full name as it appears on the resume (null if absent)
- email / phone: first occurrence; null if absent
- current_role / current_company: most recent position
- years_experience: total years of professional work (number, null if unclear)
- notice_period: e.g. "Immediate", "30 days", "2 months", "Currently serving", null
- skills: technical and professional skills only; deduplicate; normalise to lowercase; max 30
- education: all degrees and certifications; year is graduation year (int or null)
- work_history: all positions, newest first; duration_months is approximate (null if unclear);
  highlights: up to 3 bullet points per role, verbatim from resume

Resume text:
\"\"\"{safe_text}\"\"\"
"""

    try:
        raw    = _call_llm(prompt, _PARSE_SYSTEM, temperature=0.05, max_tokens=1400)
        parsed = _parse_json(raw, fallback)

        # Skills — normalise + deduplicate
        raw_skills = parsed.get("skills", [])
        skills = list(dict.fromkeys(
            str(s).strip().lower() for s in raw_skills if s
        ))[:30]

        # Education
        education: List[EducationEntry] = []
        for e in (parsed.get("education") or []):
            if isinstance(e, dict):
                yr = e.get("year")
                try:
                    yr = int(yr) if yr is not None else None
                except (TypeError, ValueError):
                    yr = None
                education.append(EducationEntry(
                    degree=str(e.get("degree", "")).strip(),
                    institution=str(e.get("institution", "")).strip(),
                    year=yr,
                ))

        # Work history
        work_history: List[WorkHistoryEntry] = []
        for w in (parsed.get("work_history") or []):
            if isinstance(w, dict):
                dm = w.get("duration_months")
                try:
                    dm = int(dm) if dm is not None else None
                except (TypeError, ValueError):
                    dm = None
                highlights = [str(h).strip() for h in (w.get("highlights") or []) if h][:3]
                work_history.append(WorkHistoryEntry(
                    company=str(w.get("company", "")).strip(),
                    role=str(w.get("role", "")).strip(),
                    duration_months=dm,
                    highlights=highlights,
                ))

        # years_experience
        yoe = parsed.get("years_experience")
        try:
            yoe = float(yoe) if yoe is not None else None
        except (TypeError, ValueError):
            yoe = None

        def _str_or_none(val: Any) -> Optional[str]:
            s = str(val).strip() if val is not None else ""
            return s or None

        return ParseResumeResponse(
            success=True,
            full_name=       _str_or_none(parsed.get("full_name")),
            email=           _str_or_none(parsed.get("email")),
            phone=           _str_or_none(parsed.get("phone")),
            current_role=    _str_or_none(parsed.get("current_role")),
            current_company= _str_or_none(parsed.get("current_company")),
            skills=          skills,
            years_experience=yoe,
            notice_period=   _str_or_none(parsed.get("notice_period")),
            education=       education,
            work_history=    work_history,
        )

    except Exception as e:
        logger.warning(f"parse_resume LLM call failed — returning empty data: {e}")
        return ParseResumeResponse(success=True, **fallback, error=str(e))


# ─── Endpoint: rank-candidate ─────────────────────────────────────────────────

_RANK_SYSTEM = (
    "You are an expert technical recruiter. "
    "Score this candidate objectively against the job description. "
    "Return ONLY valid JSON — no markdown, no explanation."
)

@router.post("/api/rank-candidate", response_model=RankCandidateResponse)
async def rank_candidate(
    req: RankCandidateRequest,
    api_key: str = Depends(verify_api_key),
):
    """
    Score a candidate's resume against a job description.
    Accepts either a structured candidate_profile dict or raw resume_text.
    Returns skill/experience/overall fit scores, skill gaps, and a 2-sentence fitSummary.
    """
    safe_jd     = _sanitize(req.job_description, 3000)
    safe_skills = [_sanitize(s, 100) for s in req.required_skills[:30]]
    exp_req     = req.experience_required  # may be None

    # Build candidate profile block
    if req.candidate_profile:
        cp = req.candidate_profile
        edu_str = '; '.join(
            e.get('degree', '') + ' from ' + e.get('institution', '')
            for e in cp.get('education', [])
        ) or 'Not specified'
        profile_block = (
            f"Skills: {', '.join(cp.get('skills', [])) or 'Not specified'}\n"
            f"Years of Experience: {cp.get('years_experience') or 'Unknown'}\n"
            f"Current Role: {cp.get('current_role') or 'Unknown'}\n"
            f"Current Company: {cp.get('current_company') or 'Unknown'}\n"
            f"Notice Period: {cp.get('notice_period') or 'Not specified'}\n"
            f"Education: {edu_str}"
        )
    elif req.resume_text:
        profile_block = _sanitize(req.resume_text, 3000)
    else:
        return RankCandidateResponse(success=False, error="Either candidate_profile or resume_text is required")

    exp_note = f"\nRole requires {exp_req}+ years of experience." if exp_req is not None else ""

    fallback: dict = {
        "skill_match_pct": 50, "experience_fit": 50, "overall_fit": 50,
        "missing_skills": [], "matching_skills": [], "fit_summary": None,
    }

    prompt = f"""Score this candidate against the job description below.{exp_note}

Job Description:
\"\"\"{safe_jd}\"\"\"

Required Skills:
{safe_skills}

Candidate Profile:
\"\"\"{profile_block}\"\"\"

Return ONLY this exact JSON:
{{
  "skill_match_pct": <0-100 integer>,
  "experience_fit": <0-100 integer>,
  "overall_fit": <0-100 integer>,
  "missing_skills": ["skill1", "skill2"],
  "matching_skills": ["skill3", "skill4"],
  "fit_summary": "Two sentences max. First: overall assessment. Second: key strength or critical gap."
}}

Scoring rules:
- skill_match_pct: % of required_skills found in the candidate profile
- experience_fit: how well candidate's years and domain match the role requirements
- overall_fit: weighted score — skills 50%, experience 30%, education/domain 20%
- missing_skills: required skills NOT found (max 10)
- matching_skills: required skills that ARE found (max 10)
- fit_summary: objective 1-2 sentence summary; never mention candidate name
"""

    try:
        raw    = _call_llm(prompt, _RANK_SYSTEM, temperature=0.05, max_tokens=600)
        parsed = _parse_json(raw, fallback)

        def clamp(v: Any, default: int = 50) -> int:
            try:
                return max(0, min(100, int(v)))
            except (TypeError, ValueError):
                return default

        fit_summary_raw = parsed.get("fit_summary")
        fit_summary = str(fit_summary_raw).strip() if fit_summary_raw else None

        return RankCandidateResponse(
            success=True,
            skill_match_pct=clamp(parsed.get("skill_match_pct")),
            experience_fit= clamp(parsed.get("experience_fit")),
            overall_fit=    clamp(parsed.get("overall_fit")),
            missing_skills= [str(s) for s in parsed.get("missing_skills",  [])][:10],
            matching_skills=[str(s) for s in parsed.get("matching_skills", [])][:10],
            fit_summary=    fit_summary,
        )

    except Exception as e:
        logger.warning(f"rank_candidate LLM call failed — using fallback: {e}")
        return RankCandidateResponse(success=True, **fallback, error=str(e))
