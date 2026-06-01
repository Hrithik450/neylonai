import os
import sys
import requests
from dotenv import load_dotenv
from .utils import INTERNAL_DATA_PATH

load_dotenv()

GCS_URL = os.getenv("GCS_URL")
if not GCS_URL:
    raise ValueError("GCS_URL environment variable not set.")

def ensure_jsonl_file():
    """Ensure the JSONL file exists locally; download from GCS if not."""
    if INTERNAL_DATA_PATH.exists():
        return str(INTERNAL_DATA_PATH)
    
    INTERNAL_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    print("Downloading JSONL file from GCS...")

    response = requests.get(GCS_URL, stream=True)
    response.raise_for_status()

    total_size = int(response.headers.get('content-length', 0))
    downloaded = 0
    chunk_size = 8192

    with INTERNAL_DATA_PATH.open("wb") as f:
        for chunk in response.iter_content(chunk_size=chunk_size):
            f.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                percent = downloaded / total_size * 100
                # Print percentage in-place
                sys.stdout.write(f"Downloading: {percent:.1f}%")
                sys.stdout.flush()

    print("Download complete:", INTERNAL_DATA_PATH)
    return str(INTERNAL_DATA_PATH)