from lib.utils import CHROMA_COLLECTION_NAME, EMAIL_JSON_PATH
from functools import lru_cache
from dotenv import load_dotenv
import polars as pl
import chromadb
import os

# --- Environment Check ---
# --- Universal load_resources function ---
def _load_resources_base():
    """
    Base function that loads data and connects to ChromaDB, adapting its behavior
    based on whether it's running in Streamlit or a command-line environment.
    """
    # --- 1. Conditional Data Source Logic ---
    data_path = ""
    # --- COMMAND-LINE PATH: Use local file ---
    print("Command-line environment detected. Using local data file.")
    data_path = EMAIL_JSON_PATH
    if not os.path.exists(data_path):
        # Provide a clear error if the local file is missing.
        raise FileNotFoundError(f"Local data file not found at '{data_path}'. Please ensure it exists before running chatbot.py.")

    # --- 2. Shared Polars Loading Logic ---
    # This part is now the same for both environments, it just uses the determined data_path.
    print(f"Loading email metadata from: {data_path}")
    df = pl.read_ndjson(data_path)
    print(f"Successfully loaded {df.height} records for metadata.")

    # --- 3. Shared ChromaDB Connection Logic ---
    # This logic correctly handles secrets for both environments.
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

# --- Environment-Specific Function Wrapper ---
load_dotenv()
@lru_cache(maxsize=None)
def load_resources():
    return _load_resources_base()

# --- Global variables that your tools will import ---
df, chroma_collection = load_resources()