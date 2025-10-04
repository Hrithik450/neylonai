from .utils import CHROMA_COLLECTION_NAME, EMAIL_JSON_PATH
from .download_jsonl import ensure_jsonl_file

from functools import lru_cache
from dotenv import load_dotenv
from pathlib import Path
import polars as pl
import chromadb
import os

load_dotenv()

# --- Environment Check ---
def get_data_path() -> Path:
    """
    Ensure the email JSONL data file exists locally.
    Downloads it once via ensure_jsonl_file() if missing.
    """
    if EMAIL_JSON_PATH.exists() and EMAIL_JSON_PATH.stat().st_size > 0:
        print(f"Using local data file at {EMAIL_JSON_PATH}")
        return EMAIL_JSON_PATH
    
    print("⚠️ Local data file not found. Downloading from remote source...")
    path = ensure_jsonl_file()
    print(f"Downloaded data file to {EMAIL_JSON_PATH}")
    return Path(path)

# --- Core loader function ---
def _load_resources_base():
    """
    Base function that loads data and connects to ChromaDB, adapting its behavior
    based on whether it's running in Streamlit or a command-line environment.
    """
    # --- 1. Resolve data path ---
    data_path = get_data_path()

    # --- 2. Load JSONL file into Polars ---
    print(f"Loading email metadata from: {data_path}")
    try:
        df = pl.read_ndjson(data_path)
        print(f"Loaded {df.height} email records.")
    except Exception as e:
        raise RuntimeError(f"Failed to load email metadata from {data_path}: {e}")

    # --- 3. Connect to ChromaDB ---
    print("🔗 Connecting to ChromaDB Vector Store...")
    try:
        client = chromadb.CloudClient(
            api_key=os.getenv("CHROMA_API_KEY"),
            tenant=os.getenv("CHROMA_TENANT"),
            database=os.getenv("CHROMA_DATABASE")
        )
        collection = client.get_collection(name=CHROMA_COLLECTION_NAME)
        print("Connected to ChromaDB collection: {CHROMA_COLLECTION_NAME}.")
    except Exception as e:
        print(f"FATAL ERROR: Could not connect to ChromaDB. {e}")
        collection = None
    
    return df, collection

# --- Environment-Specific Function Wrapper ---
@lru_cache(maxsize=None)
def load_resources():
    """Load and cache email dataset and Chroma collection for global reuse."""
    return _load_resources_base()

# --- Global variables that your tools will import ---
df, chroma_collection = load_resources()