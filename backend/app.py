from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from api import prompts, model_configs, test_runs, openrouter, prompt_classify

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Red Team Prompt Testing Platform", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://teamtesthub.us",
        "https://www.teamtesthub.us",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prompts.router)
app.include_router(model_configs.router)
app.include_router(test_runs.router)
app.include_router(openrouter.router)
app.include_router(prompt_classify.router)


@app.get("/")
def root():
    return {
        "message": "Red Team Prompt Testing Platform API",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
