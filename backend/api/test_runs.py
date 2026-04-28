from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models import (
    TestRunModel,
    TestRunCreate,
    TestRunResponse,
    PromptVersionModel,
    ModelConfigModel,
    ModelResponseModel,
)
from services.model_executor import ModelExecutor
from services.evaluation import ResponseEvaluator
import asyncio

router = APIRouter(prefix="/api/test-runs", tags=["test_runs"])
executor = ModelExecutor()
evaluator = ResponseEvaluator()


@router.post("/", response_model=dict)
async def create_test_run(
    test_run: TestRunCreate,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
):
    """
    Execute a prompt against multiple models in parallel.
    Returns immediately with test_run_id; results populate as they complete.
    """
    prompt_version = db.query(PromptVersionModel).filter(
        PromptVersionModel.id == test_run.prompt_version_id
    ).first()
    if not prompt_version:
        raise HTTPException(status_code=404, detail="Prompt version not found")

    model_configs = db.query(ModelConfigModel).filter(
        ModelConfigModel.id.in_(test_run.model_config_ids)
    ).all()
    if not model_configs:
        raise HTTPException(status_code=404, detail="No valid model configs")

    test_runs = []
    for config in model_configs:
        db_test_run = TestRunModel(
            prompt_version_id=test_run.prompt_version_id,
            model_config_id=config.id,
        )
        db.add(db_test_run)
        test_runs.append(db_test_run)

    db.commit()
    for tr in test_runs:
        db.refresh(tr)

    if background_tasks:
        background_tasks.add_task(
            _execute_models_async,
            test_runs,
            model_configs,
            prompt_version,
            db,
        )

    return {
        "test_run_ids": [tr.id for tr in test_runs],
        "status": "queued",
    }


async def _execute_models_async(test_runs, model_configs, prompt_version, db):
    """Background task to execute models and store results."""
    system_context = prompt_version.prompt.system_context
    user_prompt = prompt_version.content

    config_dicts = [
        {
            "model_name": c.model_name,
            "endpoint_type": c.endpoint_type,
            "endpoint_url": c.endpoint_url,
            "api_key": c.api_key,
            "max_tokens": c.max_tokens,
            "temperature": c.temperature,
        }
        for c in model_configs
    ]

    results = await executor.execute_prompt(system_context, user_prompt, config_dicts)

    for test_run, result in zip(test_runs, results):
        eval_status, eval_reason = evaluator.evaluate(
            result.get("response_text", ""),
            finish_reason=result.get("finish_reason"),
            explicit_refusal=result.get("explicit_refusal", False),
        )

        response = ModelResponseModel(
            test_run_id=test_run.id,
            model_name=result["model_name"],
            response_text=result["response_text"],
            latency_ms=result["latency_ms"],
            tokens_used=result["tokens_used"],
            error_message=result.get("error_message"),
            evaluation_status=eval_status,
            evaluation_reason=eval_reason,
        )
        db.add(response)

    db.commit()


@router.get("/{test_run_id}", response_model=TestRunResponse)
def get_test_run(test_run_id: int, db: Session = Depends(get_db)):
    """Get test run results."""
    test_run = db.query(TestRunModel).filter(TestRunModel.id == test_run_id).first()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return test_run


@router.get("/{test_run_id}/results")
def get_test_run_results(test_run_id: int, db: Session = Depends(get_db)):
    """Get all model responses for a test run."""
    test_run = db.query(TestRunModel).filter(TestRunModel.id == test_run_id).first()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    responses = db.query(ModelResponseModel).filter(
        ModelResponseModel.test_run_id == test_run_id
    ).all()
    return responses
