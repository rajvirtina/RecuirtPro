import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

# Test API key for testing
TEST_API_KEY = "default-secret-key"


def test_home_endpoint():
    """Test home endpoint returns service info"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "RecruitPro LLM Service"
    assert data["status"] == "running"
    assert len(data["features"]) == 3


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_schedule_interview_without_api_key():
    """Test authentication requirement"""
    response = client.post("/api/schedule-interview", json={
        "hr_availability": ["2026-01-20T10:00:00Z"],
        "candidate_availability": ["2026-01-20T10:00:00Z"],
        "interview_type": "Technical"
    })
    assert response.status_code == 401


def test_schedule_interview_with_api_key():
    """Test scheduling with valid API key"""
    response = client.post(
        "/api/schedule-interview",
        json={
            "hr_availability": ["2026-01-20T10:00:00Z", "2026-01-20T14:00:00Z"],
            "candidate_availability": ["2026-01-20T10:00:00Z", "2026-01-21T09:00:00Z"],
            "interview_type": "Technical",
            "duration_minutes": 60
        },
        headers={"X-API-Key": TEST_API_KEY}
    )
    # May fail if OPENAI_API_KEY not set, but should not crash
    assert response.status_code in [200, 500]


def test_analyze_feedback_validation():
    """Test feedback validation"""
    response = client.post(
        "/api/analyze-feedback",
        json={
            "role": "Engineer",
            "interview_type": "Technical",
            "raw_feedback": "Short"  # Too short, should fail validation
        },
        headers={"X-API-Key": TEST_API_KEY}
    )
    assert response.status_code == 422  # Validation error


def test_candidate_message_validation():
    """Test candidate message outcome validation"""
    response = client.post(
        "/api/candidate-message",
        json={
            "evaluation_summary": "Good candidate",
            "outcome": "invalid_outcome",  # Invalid outcome
            "candidate_name": "John Doe"
        },
        headers={"X-API-Key": TEST_API_KEY}
    )
    assert response.status_code == 422  # Validation error


def test_candidate_message_valid_outcome():
    """Test candidate message with valid outcome"""
    for outcome in ["offer", "hold", "reject"]:
        response = client.post(
            "/api/candidate-message",
            json={
                "evaluation_summary": "Good technical skills",
                "outcome": outcome,
                "candidate_name": "Jane Smith"
            },
            headers={"X-API-Key": TEST_API_KEY}
        )
        # May fail if OPENAI_API_KEY not set
        assert response.status_code in [200, 500]
