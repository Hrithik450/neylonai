import os
import chromadb
import polars as pl
from dotenv import load_dotenv
from functools import lru_cache
from .download_jsonl import ensure_jsonl_file
from .utils import EMAIL_JSON_PATH, CHROMA_COLLECTION_NAME

load_dotenv()

def _load_resources_base():
    """
    Base function that loads data and connects to ChromaDB, adapting its behavior
    based on whether it's running in Streamlit or a command-line environment.
    """
    data_path = ""
    print("Command-line environment detected. Using local data file.")
    if EMAIL_JSON_PATH.exists():
        print(f"Using local data file at {EMAIL_JSON_PATH}")
        data_path = EMAIL_JSON_PATH
    else:
        data_path = ensure_jsonl_file()
        print(f"Downloaded data file to {EMAIL_JSON_PATH}")

    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Local data file not found at '{data_path}'. Please ensure it exists before running server.")
    
    print(f"Loading email metadata from: {data_path}")
    df = pl.read_ndjson(data_path)
    print(f"Successfully loaded {df.height} records for metadata.")

    print("Connecting to ChromaDB Vector Store...")
    try:
        client = chromadb.CloudClient(
            api_key=os.getenv("CHROMA_API_KEY"),
            tenant=os.getenv("CHROMA_TENANT"),
            database=os.getenv("CHROMA_DATABASE")
        )
        collection = client.get_collection(name=CHROMA_COLLECTION_NAME)
        print("Successfully connected to ChromaDB collection.")
    except Exception as e:
        print(f"FATAL ERROR: Could not connect to ChromaDB. {e}")
        collection = None

    return df, collection

@lru_cache(maxsize=None)
def load_resources():
    return _load_resources_base()

df, chroma_collection = load_resources()