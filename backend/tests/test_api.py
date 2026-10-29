import io
import json
from types import SimpleNamespace

import fitz
import pytest
from docx import Document
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app, extract_resume
from app.analyzer import analyze

client = TestClient(app)


def test_extract_pdf():
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "Jordan Lee Python developer skills and projects with experience")
    content = document.tobytes()
    document.close()
    assert "Python developer" in extract_resume("resume.pdf", content)


def test_extract_docx():
    document = Document()
    document.add_paragraph("Jordan Lee has Python skills and experience building projects.")
    output = io.BytesIO()
    document.save(output)
    assert "Python skills" in extract_resume("resume.docx", output.getvalue())


@pytest.mark.parametrize(("filename", "content", "status"), [
    ("resume.txt", b"some text that is long enough to parse as a resume", 415),
    ("resume.pdf", b"not a pdf document", 400),
    ("resume.docx", b"not a docx document", 400),
    ("resume.pdf", b"", 400),
])
def test_invalid_uploads(filename, content, status):
    with pytest.raises(HTTPException) as caught:
        extract_resume(filename, content)
    assert caught.value.status_code == status


def test_upload_size_limit():
    with pytest.raises(HTTPException) as caught:
        extract_resume("resume.pdf", b"%PDF-" + b"x" * (5 * 1024 * 1024))
    assert caught.value.status_code == 413


def test_ai_cannot_claim_unquoted_skills(monkeypatch):
    content = {
        "resume_summary": "A student resume mentioning Python.",
        "skills": [
            {"name": "Python", "category": "Programming languages", "evidence": "Mentioned", "excerpt": "Python", "confidence": 100},
            {"name": "Kubernetes", "category": "Cloud and DevOps", "evidence": "Mentioned", "excerpt": "not in resume", "confidence": 100},
        ],
        "resume_improvements": [],
        "resume_score": {
            "overall": 70,
            "dimensions": {"skills_relevance": 70, "project_evidence": 70, "structure": 70, "readability": 70, "keyword_coverage": 70},
            "explanation": ["Guidance only."],
        },
    }
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(content)))])
    completions = SimpleNamespace(create=lambda **kwargs: response)
    monkeypatch.setattr("app.analyzer._client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=completions)))
    result = client.post("/api/resume/analyze", json={"resume_text": "Jordan Lee has Python skills and experience building a useful student project."})
    assert result.status_code == 200
    assert [skill["name"] for skill in result.json()["skills"]] == ["Python"]


def test_upload_requires_readable_resume():
    response = client.post("/api/resume/upload", files={"file": ("resume.txt", b"text", "text/plain")})
    assert response.status_code == 415
    assert "PDF or DOCX" in response.json()["detail"]


def test_vite_dev_origin_is_allowed():
    response = client.options(
        "/api/resume/analyze",
        headers={
            "Origin": "http://127.0.0.1:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"


def test_analysis_validation_and_demo_mode(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    response = client.post("/api/resume/analyze", json={"resume_text": "Jordan Lee studied computer science. Python, SQL, and React. Built a project."})
    assert response.status_code == 200
    data = response.json()
    assert data["demo_mode"] is True
    assert 0 <= data["resume_score"]["overall"] <= 100
    assert any(skill["name"] == "Python" for skill in data["skills"])
    assert data["job_recommendations"]


def test_analysis_rejects_short_text():
    response = client.post("/api/resume/analyze", json={"resume_text": "too short"})
    assert response.status_code == 422


def test_missing_ai_key_is_reported(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "true")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/resume/analyze", json={"resume_text": "Jordan Lee has Python skills and experience building a useful student project."})
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_malformed_ai_response_is_reported(monkeypatch):
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="not json"))])
    completions = SimpleNamespace(create=lambda **kwargs: response)
    client_mock = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    monkeypatch.setattr("app.analyzer._client", lambda: client_mock)
    monkeypatch.setenv("AI_ENABLED", "true")
    result = client.post("/api/resume/analyze", json={"resume_text": "Jordan Lee has Python skills and experience building a useful student project."})
    assert result.status_code == 502
    assert "invalid data" in result.json()["detail"]


def test_role_matching_and_gap_are_deterministic(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "false")
    first = analyze("Education: Computer Science. Skills: Python, SQL, Git. Project: built API.")
    second = analyze("Education: Computer Science. Skills: Python, SQL, Git. Project: built API.")
    assert first.job_recommendations[0].role == second.job_recommendations[0].role
    assert first.missing_skills
    assert "absence here does not mean you do not know it" in first.missing_skills[0].reason
