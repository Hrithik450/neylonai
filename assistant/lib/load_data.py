from .utils import CHROMA_COLLECTION_NAME, INTERNAL_DATA_PATH
from .load_jsonl import ensure_jsonl_file

from chromadb import CloudClient
from functools import lru_cache
from dotenv import load_dotenv
from pathlib import Path
import polars as pl
import gdown
import os

load_dotenv()

# class DataService

#     @classmethod
#     def get_data_path():
#         """
#         Ensure the email JSONL data file exists locally.
#         Downloads it once via ensure_jsonl_file() if missing.
#         """
#         if


# --- Environment Check ---
def get_data_path() -> Path:
    """
    Ensure the email JSONL data file exists locally.
    Downloads it once via ensure_jsonl_file() if missing.
    """
    if INTERNAL_DATA_PATH.exists() and INTERNAL_DATA_PATH.stat().st_size > 0:
        print(f"Using local data file at {INTERNAL_DATA_PATH}")
        return INTERNAL_DATA_PATH

    print("⚠️ Local data file not found. Downloading from remote source...")
    path = ensure_jsonl_file()
    print(f"Downloaded data file to {INTERNAL_DATA_PATH}")
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
    print(f"Loading internal data from: {data_path}")
    try:
        df = pl.read_ndjson(data_path)
        print(f"Loaded {df.height} records.")
    except Exception as e:
        raise RuntimeError(f"Failed to load internal data from {data_path}: {e}")

    # --- 3. Connect to ChromaDB ---
    print("🔗 Connecting to ChromaDB Vector Store...")
    try:
        client = CloudClient(
            api_key=os.getenv("CHROMA_API_KEY"),
            tenant=os.getenv("CHROMA_TENANT"),
            database=os.getenv("CHROMA_DATABASE"),
        )
        collection = client.get_collection(name=CHROMA_COLLECTION_NAME)
        print(f"Connected to ChromaDB collection: {CHROMA_COLLECTION_NAME}.")
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
# df, chroma_collection = load_resources()

df = None
chroma_collection = None
