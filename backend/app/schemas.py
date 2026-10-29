from typing import Literal

from pydantic import BaseModel, Field


class Skill(BaseModel):
    name: str
    category: str
    evidence: Literal["Mentioned", "Inferred"]
    excerpt: str = ""
    confidence: int = Field(ge=0, le=100)


class RoleRecommendation(BaseModel):
    role: str
    match_percentage: int = Field(ge=0, le=100)
    reason: str
    matching_skills: list[str]
    missing_skills: list[str]
    next_steps: list[str]


class SkillGap(BaseModel):
    skill: str
    priority: Literal["High", "Medium", "Low"]
    reason: str
    evidence_status: Literal["Not mentioned", "Needs project evidence"] = "Not mentioned"


class LearningSuggestion(BaseModel):
    skill: str
    why_useful: str
    learning_path: list[str]
    practice_project: str
    estimated_duration: str
    resources: list[dict[str, str]]


class ResumeImprovement(BaseModel):
    section: str
    issue: str
    why: str
    suggestion: str
    priority: Literal["High", "Medium", "Low"]


class ScoreDimensions(BaseModel):
    skills_relevance: int = Field(ge=0, le=100)
    project_evidence: int = Field(ge=0, le=100)
    structure: int = Field(ge=0, le=100)
    readability: int = Field(ge=0, le=100)
    keyword_coverage: int = Field(ge=0, le=100)


class ResumeScore(BaseModel):
    overall: int = Field(ge=0, le=100)
    dimensions: ScoreDimensions
    explanation: list[str]


class AnalysisResponse(BaseModel):
    resume_summary: str
    skills: list[Skill]
    job_recommendations: list[RoleRecommendation]
    missing_skills: list[SkillGap]
    learning_suggestions: list[LearningSuggestion]
    resume_improvements: list[ResumeImprovement]
    resume_score: ResumeScore
    selected_role: str | None = None
    demo_mode: bool


class AnalysisRequest(BaseModel):
    resume_text: str = Field(min_length=30, max_length=30000)
    target_role: str | None = Field(default=None, max_length=80)


class ImprovementRequest(BaseModel):
    resume_text: str = Field(min_length=30, max_length=30000)
    section: str = Field(min_length=1, max_length=80)
    current_text: str = Field(min_length=1, max_length=5000)


class ImprovementResponse(BaseModel):
    section: str
    original: str
    suggested: str
    note: str


class ResumeExportRequest(BaseModel):
    resume_text: str = Field(min_length=30, max_length=30000)
