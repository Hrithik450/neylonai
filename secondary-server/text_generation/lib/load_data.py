import os
import sys
import json
import requests
import polars as pl
from dotenv import load_dotenv
from functools import lru_cache
from chromadb import CloudClient
from .utils import CHROMA_COLLECTION_NAME

load_dotenv()

GCS_URL = os.getenv("GCS_URL")
if not GCS_URL:
    raise ValueError("GCS_URL environment variable not set.")

def stream_remote_jsonl(url, max_size_mb=50):
    """
    Stream JSONL file from a remote URL in Polars DataFrames batches of max_size_mb.
    """
    batch = []
    current_batch_size = 0
    max_bytes = max_size_mb * 1024 * 1024

    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        buffer = ""
        for chunk in r.iter_content(chunk_size=8192, decode_unicode=True):
            buffer += chunk
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                if not line.strip():
                    continue
                row = json.loads(line)
                row_bytes = sys.getsizeof(json.dumps(row))
                if current_batch_size + row_bytes > max_bytes and batch:
                    yield pl.DataFrame(batch)
                    batch = []
                    current_batch_size = 0
                batch.append(row)
                current_batch_size += row_bytes
            
        if batch:
            yield pl.DataFrame(batch)

def _load_resources_base():
    """Return a generator of Polars DataFrames in batches"""
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
    return stream_remote_jsonl(url=GCS_URL), collection

@lru_cache(maxsize=None)
def load_resources():
    """Load resources with caching to avoid reloading on every call."""
    batch_generator, collection = _load_resources_base()
    return batch_generator, collection

batch_generator, chroma_collection = load_resources()