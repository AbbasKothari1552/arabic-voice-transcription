import os
import uuid
import shutil
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import torch

from app.model_manager import manager
from app.audio_utils import load_and_preprocess_audio, prepare_inputs

app = FastAPI(title="Arabic Voice Transcription API")

# Enable CORS for frontend web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure recordings directory exists
RECORDINGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "recordings")
os.makedirs(RECORDINGS_DIR, exist_ok=True)

# Mount static folder for frontend UI
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ==================== Pydantic Models (Request/Response) ====================

class DownloadResponse(BaseModel):
    status: str
    path: str

class TranscribeRequest(BaseModel):
    file_path: str   # absolute or relative path to the audio file on the server

class TranscribeResponse(BaseModel):
    transcription: str
    file_path: str


# Load model at startup
model, processor = manager.download_and_load()
model.eval()

@app.get("/")
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Arabic Voice Transcription API is running. UI not found in static folder."}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/download")
async def download_model():
    """Force the model to download (or just report current status)."""
    try:
        manager.download_and_load()
        return {"status": "ready", "path": manager.cache_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe(request: TranscribeRequest):
    file_path = request.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return run_transcription(file_path)

@app.post("/transcribe-file")
async def transcribe_file(file: UploadFile = File(...)):
    """Accept uploaded .wav or audio files directly from web client."""
    try:
        filename = f"{uuid.uuid4().hex}_{file.filename if file.filename else 'audio.wav'}"
        if not filename.endswith(".wav"):
            filename += ".wav"
        save_path = os.path.join(RECORDINGS_DIR, filename)

        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return run_transcription(save_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save and process uploaded file: {str(e)}")

def run_transcription(file_path: str):
    try:
        # Preprocess
        audio_array, sr = load_and_preprocess_audio(file_path, target_sr=16000)
        inputs = prepare_inputs(processor, audio_array, sr)

        # Inference
        with torch.no_grad():
            logits = model(inputs.input_values, attention_mask=inputs.attention_mask).logits

        # Decode
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = processor.batch_decode(predicted_ids)[0]

        return TranscribeResponse(transcription=transcription, file_path=file_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")