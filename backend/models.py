from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List
from database import Base


class PromptModel(Base):
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    system_context = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship("PromptVersionModel", back_populates="prompt", cascade="all, delete-orphan")


class PromptVersionModel(Base):
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True, index=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id"))
    version_num = Column(Integer)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    prompt = relationship("PromptModel", back_populates="versions")
    test_runs = relationship("TestRunModel", back_populates="prompt_version")


class ModelConfigModel(Base):
    __tablename__ = "model_configs"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String, unique=True, index=True)
    endpoint_type = Column(String)
    endpoint_url = Column(String)
    api_key = Column(String, nullable=True)
    max_tokens = Column(Integer, default=2000)
    temperature = Column(Float, default=0.7)
    created_at = Column(DateTime, default=datetime.utcnow)

    test_runs = relationship("TestRunModel", back_populates="model_config")


class TestRunModel(Base):
    __tablename__ = "test_runs"

    id = Column(Integer, primary_key=True, index=True)
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"))
    model_config_id = Column(Integer, ForeignKey("model_configs.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    prompt_version = relationship("PromptVersionModel", back_populates="test_runs")
    model_config = relationship("ModelConfigModel", back_populates="test_runs")
    responses = relationship("ModelResponseModel", back_populates="test_run", cascade="all, delete-orphan")


class ModelResponseModel(Base):
    __tablename__ = "model_responses"

    id = Column(Integer, primary_key=True, index=True)
    test_run_id = Column(Integer, ForeignKey("test_runs.id"))
    model_name = Column(String)
    response_text = Column(Text)
    latency_ms = Column(Float, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    error_message = Column(String, nullable=True)
    evaluation_status = Column(String, default="unknown")
    evaluation_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    test_run = relationship("TestRunModel", back_populates="responses")


class PromptCreate(BaseModel):
    name: str
    system_context: str


class PromptUpdate(BaseModel):
    system_context: Optional[str] = None


class PromptVersionCreate(BaseModel):
    prompt_id: int
    content: str


class ModelConfigCreate(BaseModel):
    model_name: str
    endpoint_type: str
    endpoint_url: str
    api_key: Optional[str] = None
    max_tokens: int = 2000
    temperature: float = 0.7


class TestRunCreate(BaseModel):
    prompt_version_id: int
    model_config_ids: List[int]


class ModelResponseSchema(BaseModel):
    model_name: str
    response_text: str
    latency_ms: Optional[float] = None
    tokens_used: Optional[int] = None
    error_message: Optional[str] = None
    evaluation_status: str = "unknown"
    evaluation_reason: Optional[str] = None

    class Config:
        from_attributes = True


class TestRunResponse(BaseModel):
    id: int
    created_at: datetime
    responses: List[ModelResponseSchema]

    class Config:
        from_attributes = True


class PromptResponse(BaseModel):
    id: int
    name: str
    system_context: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ModelConfigResponse(BaseModel):
    id: int
    model_name: str
    endpoint_type: str
    endpoint_url: str
    max_tokens: int
    temperature: float

    class Config:
        from_attributes = True
