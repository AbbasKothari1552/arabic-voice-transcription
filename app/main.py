from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from app.model_manager import manager
from app.audio_utils import load_and_preprocess_audio, prepare_inputs
import os

app = FastAPI()

# ==================== Pydantic Models (Request/Response) ====================

class DownloadResponse(BaseModel):
    status: str
    path: str

class TranscribeRequest(BaseModel):
    file_path: str   # absolute or relative path to the audio file on the server

class TranscribeResponse(BaseModel):
    transcription: str
    file_path: str



# Load model at startup (downloads automatically if needed)
model, processor = manager.download_and_load()
model.eval()

@app.post("/download")
async def download_model():
    """Force the model to download (or just report current status)."""
    # Since we already loaded at startup, it's already downloaded.
    # But if you want to check/force explicitly:
    try:
        # This will download only if missing
        manager.download_and_load()
        return {"status": "ready", "path": manager.cache_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe(request: TranscribeRequest):
    file_path = request.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

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