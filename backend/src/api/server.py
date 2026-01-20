"""
FastAPI server for ShieldAI backend
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from ..detectors import ShieldAIEngine, DetectionResult

app = FastAPI(
    title="ShieldAI API",
    description="機密情報検出・マスク処理API",
    version="1.0.0"
)

# CORS設定（Electronからのアクセス用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# グローバルエンジンインスタンス
engine: Optional[ShieldAIEngine] = None


class DetectRequest(BaseModel):
    """Detection request model"""
    text: str = Field(..., description="検出対象のテキスト")
    use_llm: bool = Field(False, description="LLM検出を使用するか")


class DetectionItem(BaseModel):
    """Single detection item"""
    entity_type: str
    text: str
    start: int
    end: int
    score: float
    method: str
    label: str


class DetectResponse(BaseModel):
    """Detection response model"""
    original_text: str
    masked_text: str
    detections: list[DetectionItem]
    processing_time_ms: float
    detection_count: int


class ConfigRequest(BaseModel):
    """Configuration request model"""
    use_llm: bool = False
    llm_model: str = "gemma2:9b"
    ollama_url: str = "http://localhost:11434"


class StatusResponse(BaseModel):
    """Status response model"""
    status: str
    llm_available: bool
    version: str


@app.on_event("startup")
async def startup():
    """Initialize engine on startup"""
    global engine
    engine = ShieldAIEngine(use_llm=False)


@app.get("/", response_model=StatusResponse)
async def root():
    """Health check endpoint"""
    return StatusResponse(
        status="ok",
        llm_available=engine.is_llm_available() if engine else False,
        version="1.0.0"
    )


@app.post("/detect", response_model=DetectResponse)
async def detect(request: DetectRequest):
    """
    Detect PII in text

    - **text**: 検出対象のテキスト
    - **use_llm**: LLM検出を使用するか（デフォルト: false）
    """
    global engine

    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    # LLM設定が変更された場合はエンジンを再初期化
    if request.use_llm and not engine.use_llm:
        engine = ShieldAIEngine(use_llm=True)

    result = engine.detect(request.text)

    return DetectResponse(
        original_text=result.original_text,
        masked_text=result.masked_text,
        detections=[
            DetectionItem(
                entity_type=d.entity_type,
                text=d.text,
                start=d.start,
                end=d.end,
                score=d.score,
                method=d.method,
                label=engine.get_entity_label(d.entity_type)
            )
            for d in result.detections
        ],
        processing_time_ms=result.processing_time_ms,
        detection_count=len(result.detections)
    )


@app.post("/config")
async def configure(request: ConfigRequest):
    """
    Update engine configuration

    - **use_llm**: LLM検出を使用するか
    - **llm_model**: 使用するLLMモデル
    - **ollama_url**: Ollama APIのURL
    """
    global engine
    engine = ShieldAIEngine(
        use_llm=request.use_llm,
        llm_model=request.llm_model,
        ollama_url=request.ollama_url
    )
    return {"status": "ok", "config": request.model_dump()}


@app.get("/status")
async def status():
    """Get current engine status"""
    if not engine:
        return {"status": "not_initialized"}

    return {
        "status": "ok",
        "use_llm": engine.use_llm,
        "llm_available": engine.is_llm_available()
    }


# ===== Dictionary Management API =====

class DictionaryEntryRequest(BaseModel):
    """Dictionary entry request model"""
    value: str = Field(..., description="登録する単語")
    label: str = Field("機密情報", description="ラベル")
    category: str = Field("custom", description="カテゴリ (companies, projects, persons, custom)")


class DictionaryImportRequest(BaseModel):
    """CSV import request model"""
    csv_content: str = Field(..., description="CSVデータ")


class DictionaryEntryResponse(BaseModel):
    """Dictionary entry response"""
    value: str
    label: str
    category: str


@app.get("/dictionary")
async def get_dictionary():
    """Get all dictionary entries"""
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    entries = engine.dictionary_manager.get_all_entries()
    return {
        "entries": [
            DictionaryEntryResponse(
                value=e.value,
                label=e.label,
                category=e.category
            ).model_dump()
            for e in entries
        ],
        "count": len(entries)
    }


@app.post("/dictionary/add")
async def add_dictionary_entry(request: DictionaryEntryRequest):
    """Add a word to dictionary"""
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    success = engine.dictionary_manager.add_entry(
        value=request.value,
        label=request.label,
        category=request.category
    )

    if not success:
        raise HTTPException(status_code=400, detail="Entry already exists")

    return {"status": "ok", "message": f"Added: {request.value}"}


@app.delete("/dictionary/{value}")
async def delete_dictionary_entry(value: str):
    """Remove a word from dictionary"""
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    success = engine.dictionary_manager.remove_entry(value)

    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")

    return {"status": "ok", "message": f"Deleted: {value}"}


@app.post("/dictionary/import")
async def import_dictionary(request: DictionaryImportRequest):
    """
    Import entries from CSV

    CSV format:
    種別,値,ラベル
    会社名,株式会社ABC,会社名
    """
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    count = engine.dictionary_manager.import_csv(request.csv_content)

    return {"status": "ok", "imported": count}
