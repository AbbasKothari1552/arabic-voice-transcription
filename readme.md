# Arabic Speech‑to‑Text API

A lightweight RESTful API for transcribing Arabic speech using the `jonatasgrosman/wav2vec2-large-xlsr-53-arabic` model. The service downloads the model locally (once) and exposes simple endpoints for transcription.

## Features

- ✅ Download the model from Hugging Face to a local cache
- ✅ Transcribe Arabic audio files given a server‑side file path
- ✅ Automatic resampling to 16 kHz mono (supports various audio formats via `librosa`)
- ✅ Ready‑to‑use FastAPI service with Swagger docs at `/docs`

---

## Prerequisites

- Python 3.8 or higher
- `pip` and `virtualenv` (recommended)
- At least **2 GB of free RAM** for the model (300M parameters)
- A working audio file (WAV, MP3, etc.) for testing

---

## Installation & Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/arabic-stt-api.git
cd arabic-stt-api
```

2. **Create and activate a virtual environment**

```bash
python -m venv venv
source venv/bin/activate        # Linux/macOS
# or .\venv\Scripts\activate    # Windows
```

3. **Install dependencies**

```bash
pip install fastapi uvicorn transformers torch librosa huggingface-hub
```

4. **Configuration (optional)**  
   Edit `config.py` if you want to change the model ID or local storage path:

```python
MODEL_ID = "jonatasgrosman/wav2vec2-large-xlsr-53-arabic"
LOCAL_MODEL_DIR = "./local_models/wav2vec2_arabic"
```

---

## Running the API

Start the server with:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- The model will be **downloaded automatically** the first time you start the server (or when you call `/download`).  
- Once loaded, transcription requests are fast (a few seconds per audio file).

You can access the interactive API documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## API Endpoints

### `POST /download`

Downloads the model from Hugging Face to the local directory (if not already present).

**Response example:**
```json
{
  "status": "ready",
  "path": "./local_models/wav2vec2_arabic"
}
```

### `POST /transcribe`

Transcribes an Arabic audio file given its server‑side path.

**Request body:**
```json
{
  "file_path": "/absolute/or/relative/path/to/audio.wav"
}
```

**Response example:**
```json
{
  "transcription": "مرحبا كيف حالك",
  "file_path": "/absolute/or/relative/path/to/audio.wav"
}
```

### `GET /health`

Returns `{"status":"ok"}` – useful for monitoring.

---

## Usage Examples (curl)

**1. Download the model**

```bash
curl -X POST http://localhost:8000/download
```

**2. Transcribe an audio file**

```bash
curl -X POST http://localhost:8000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/home/user/sample_arabic.wav"}'
```

**3. Health check**

```bash
curl http://localhost:8000/health
```

---

## Audio Format Notes

- The model expects **16 kHz mono** audio.
- The API uses `librosa.load()` with `sr=16000`, so **any format supported by librosa** (WAV, MP3, FLAC, etc.) will be automatically resampled and converted to mono.
- For best accuracy, provide a clean recording with minimal background noise.

---

## Project Structure

```
arabic-stt-api/
├── main.py                 # FastAPI application & endpoints
├── model_manager.py        # Download & load the model
├── audio_utils.py          # Audio preprocessing (librosa)
├── config.py               # Model ID and local path
└── README.md               # This file
```

---

## Performance Considerations

- The model (~300M parameters) takes about **1.2 GB of RAM** when loaded.
- Inference time depends on audio length; a 10‑second clip typically transcribes in **2‑3 seconds** on a modern CPU.
- For production with high concurrency, consider deploying with multiple workers (`uvicorn --workers 4`) or using a task queue (Celery) to offload heavy inference.

---

## License

This project is for demonstration purposes. The underlying model is released under the Apache 2.0 license. Please refer to the original model card for details.

---

## Troubleshooting

- **`HFValidationError`**: Ensure you are using the Hugging Face model ID (not a local path) in `config.py`.  
- **File not found**: Provide an absolute path or a path relative to the current working directory of the server.  
- **Out‑of‑Memory**: Reduce the audio duration or consider using a smaller model variant.

---

Enjoy transcribing Arabic speech! 🎙️