from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import (
    ModelConfigModel,
    ModelConfigCreate,
    ModelConfigResponse,
)

router = APIRouter(prefix="/api/model-configs", tags=["models"])


@router.post("/", response_model=ModelConfigResponse)
def create_model_config(config: ModelConfigCreate, db: Session = Depends(get_db)):
    """Add a new model configuration."""
    existing = db.query(ModelConfigModel).filter(
        ModelConfigModel.model_name == config.model_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Model config already exists")

    db_config = ModelConfigModel(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


@router.get("/", response_model=list[ModelConfigResponse])
def list_model_configs(db: Session = Depends(get_db)):
    """List all configured models."""
    return db.query(ModelConfigModel).all()


@router.get("/{config_id}", response_model=ModelConfigResponse)
def get_model_config(config_id: int, db: Session = Depends(get_db)):
    """Get a model config by ID."""
    config = db.query(ModelConfigModel).filter(ModelConfigModel.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@router.delete("/{config_id}")
def delete_model_config(config_id: int, db: Session = Depends(get_db)):
    """Delete a model configuration."""
    config = db.query(ModelConfigModel).filter(ModelConfigModel.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    db.delete(config)
    db.commit()
    return {"status": "deleted"}
