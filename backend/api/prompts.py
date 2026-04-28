from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import (
    PromptModel,
    PromptVersionModel,
    PromptCreate,
    PromptUpdate,
    PromptVersionCreate,
    PromptResponse,
)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.post("/", response_model=PromptResponse)
def create_prompt(prompt: PromptCreate, db: Session = Depends(get_db)):
    """Create a new prompt with system context."""
    existing = db.query(PromptModel).filter(PromptModel.name == prompt.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Prompt name already exists")

    db_prompt = PromptModel(
        name=prompt.name,
        system_context=prompt.system_context,
    )
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    return db_prompt


@router.get("/{prompt_id}", response_model=PromptResponse)
def get_prompt(prompt_id: int, db: Session = Depends(get_db)):
    """Get a prompt by ID."""
    prompt = db.query(PromptModel).filter(PromptModel.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.get("/")
def list_prompts(db: Session = Depends(get_db)):
    """List all prompts."""
    return db.query(PromptModel).all()


@router.put("/{prompt_id}", response_model=PromptResponse)
def update_prompt(
    prompt_id: int, prompt: PromptUpdate, db: Session = Depends(get_db)
):
    """Update prompt system context."""
    db_prompt = db.query(PromptModel).filter(PromptModel.id == prompt_id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    if prompt.system_context is not None:
        db_prompt.system_context = prompt.system_context

    db.commit()
    db.refresh(db_prompt)
    return db_prompt


@router.post("/{prompt_id}/versions")
def create_prompt_version(
    prompt_id: int, version: PromptVersionCreate, db: Session = Depends(get_db)
):
    """Create a new version of a prompt."""
    prompt = db.query(PromptModel).filter(PromptModel.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    max_version = (
        db.query(PromptVersionModel)
        .filter(PromptVersionModel.prompt_id == prompt_id)
        .order_by(PromptVersionModel.version_num.desc())
        .first()
    )
    next_version_num = (max_version.version_num + 1) if max_version else 1

    db_version = PromptVersionModel(
        prompt_id=prompt_id,
        version_num=next_version_num,
        content=version.content,
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version


@router.get("/{prompt_id}/history")
def get_prompt_history(prompt_id: int, db: Session = Depends(get_db)):
    """Get all versions of a prompt."""
    versions = (
        db.query(PromptVersionModel)
        .filter(PromptVersionModel.prompt_id == prompt_id)
        .order_by(PromptVersionModel.version_num)
        .all()
    )
    return versions
