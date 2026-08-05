import torch
import librosa
import numpy as np

def load_and_preprocess_audio(file_path, target_sr=16000):
    """
    Load audio, resample to target_sr, convert to mono if needed.
    Returns a numpy array of shape (1, samples) and the actual sampling rate.
    """
    # Load audio (librosa resamples automatically if sr is specified)
    audio, sr = librosa.load(file_path, sr=target_sr, mono=True)
    # audio is a numpy array of shape (samples,)
    return audio, sr

def prepare_inputs(processor, audio, sampling_rate):
    """
    Process the audio array using the processor.
    Returns a dict with 'input_values' and 'attention_mask' tensors.
    """
    inputs = processor(
        audio,
        sampling_rate=sampling_rate,
        return_tensors="pt",
        padding=True
    )
    return inputs