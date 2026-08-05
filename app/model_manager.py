import os
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
from app.config import MODEL_ID, LOCAL_MODEL_DIR

class ModelManager:
    def __init__(self):
        self.model = None
        self.processor = None
        self.model_id = MODEL_ID          # Hugging Face ID
        self.cache_dir = LOCAL_MODEL_DIR  # Local storage path

    def download_and_load(self):
        """
        Downloads the model to LOCAL_MODEL_DIR (if not already there)
        and loads it into memory.
        """
        if self.model is None:
            # from_pretrained with cache_dir will download to that folder
            # if the model isn't present there.
            self.processor = Wav2Vec2Processor.from_pretrained(
                self.model_id,
                cache_dir=self.cache_dir
            )
            self.model = Wav2Vec2ForCTC.from_pretrained(
                self.model_id,
                cache_dir=self.cache_dir
            )
        return self.model, self.processor

    def get_download_status(self):
        """Checks if the model files exist locally."""
        # Hugging Face stores models in a hashed subfolder under cache_dir
        # We simply check if the directory exists and has files.
        if os.path.exists(self.cache_dir) and any(os.listdir(self.cache_dir)):
            return {"status": "already_downloaded", "path": self.cache_dir}
        else:
            return {"status": "not_downloaded", "path": self.cache_dir}

# Singleton instance
manager = ModelManager()