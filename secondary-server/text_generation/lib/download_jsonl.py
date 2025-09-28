import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(os.path.dirname(__file__))
FILE_PATH = BASE_DIR / "data" / "all_mails.jsonl"
GCS_URL = os.getenv("GCS_URL")
if not GCS_URL:
    raise ValueError("GCS_URL environment variable not set.")

def stream_remote_jsonl(max_size_mb=50):
    """Ensure the JSONL file exists locally; download from GCS if not."""
    if FILE_PATH.exists():
        return str(FILE_PATH)
    
    FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    print("Downloading JSONL file from GCS...")

    response = requests.get(GCS_URL, stream=True)
    response.raise_for_status()

    total_size = int(response.headers.get('content-length', 0))
    downloaded = 0
    chunk_size = 8192

    with FILE_PATH.open("wb") as f:
        for chunk in response.iter_content(chunk_size=chunk_size):
            f.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                percent = downloaded / total_size * 100
                # Print percentage in-place
                sys.stdout.write(f"Downloading: {percent:.1f}%")
                sys.stdout.flush()

    print("Download complete:", FILE_PATH)
    return str(FILE_PATH)