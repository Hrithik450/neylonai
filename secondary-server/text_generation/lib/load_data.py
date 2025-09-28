import os
import sys
import json
import polars as pl
from dotenv import load_dotenv
from functools import lru_cache
from chromadb import CloudClient
from .download_jsonl import ensure_jsonl_file
from .utils import EMAIL_JSON_PATH, CHROMA_COLLECTION_NAME

load_dotenv()

def get_data_path():
    if EMAIL_JSON_PATH.exists():
        print(f"Using local data file at {EMAIL_JSON_PATH}")
        return EMAIL_JSON_PATH
    else:
        path = ensure_jsonl_file()
        print(f"Downloaded data file to {EMAIL_JSON_PATH}")
        return path

def stream_batches(file_path, max_size=50):
    """
    Stream JSONL file in Polars DataFrames with each batch < max_batch_size_mb.
    """
    batch = []
    current_batch_size = 0
    max_bytes = max_size * 1024 * 1024

    with open(file_path, "r") as f:
        for line in f:
            row = json.loads(line)
            row_bytes = sys.getsizeof(json.dumps(row))
            if current_batch_size + row_bytes > max_bytes and batch:
                # yield current batch
                yield pl.DataFrame(batch)
                batch = []
                current_batch_size = 0
            batch.append(row)
            current_batch_size = row_bytes

        # yield any remaining rows
        if batch:
            yield pl.DataFrame(batch)

def _load_resources_base():
    """Return a generator of Polars DataFrames in batches"""
    data_path = get_data_path()
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Local data file not found at '{data_path}'.")

    print(f"Loading email metadata in batches from: {data_path}")

    # ChromaDB connection (same as before)
    try:
        client = CloudClient(
            api_key=os.getenv("CHROMA_API_KEY"),
            tenant=os.getenv("CHROMA_TENANT"),
            database=os.getenv("CHROMA_DATABASE")
        )
        collection = client.get_collection(name=CHROMA_COLLECTION_NAME)
        print("Successfully connected to ChromaDB collection.")
    except Exception as e:
        print(f"FATAL ERROR: Could not connect to ChromaDB. {e}")
        collection = None

    # Return generator
    return stream_batches(data_path), collection

@lru_cache(maxsize=None)
def load_resources():
    """Load resources with caching to avoid reloading on every call."""
    batch_generator, collection = _load_resources_base()
    return batch_generator, collection

batch_generator, chroma_collection = load_resources()