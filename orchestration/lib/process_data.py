import os
import json
import chromadb
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings

load_dotenv()

API_KEY = os.getenv('OPENAI_API_KEY')
embedding_model = OpenAIEmbeddings(model='text-embedding-3-large', api_key=API_KEY)

new_chunks = []
global_ids = []
global_metadata = []

path = "data/internal_data.jsonl"
with open(path, "r") as f:
    for i, line in enumerate(f):
        entry = json.loads(line)

        combined_text = ""
        for key, value in reversed(list(entry.items())):
            if key not in ['tags', 'chunk', 'docId']:
                combined_text += f"{key}: {value} "
        combined_text = combined_text.strip()
        new_chunks.append(combined_text)

        global_ids.append(f"{entry.get('docId')}_{entry.get('chunk', i)}")
        global_metadata.append({
            "docId": entry.get("docId"),
            "updated_at": entry.get("updated_at")
        })

embeddings_list = []
batch_size = 5
for i in range(0, len(new_chunks), batch_size):
    batch = new_chunks[i:i+batch_size]
    batch_embeddings = embedding_model.embed_documents(batch)
    embeddings_list.extend(batch_embeddings)

client = chromadb.CloudClient(
  api_key=os.getenv('CHROMA_API_KEY'),
  tenant=os.getenv('CHROMA_TENANT'),
  database=os.getenv('CHROMA_DATABASE')
)

collection = client.get_or_create_collection("organization_data")

if len(embeddings_list) != len(new_chunks):
    raise ValueError("Embeddings list and JSONL entries count do not match!")

if embeddings_list:
    collection.upsert(
        ids=global_ids,
        documents=new_chunks,
        embeddings=embeddings_list,
        metadatas=global_metadata
    )
    print(f"Upserted {len(new_chunks)} changed entries into Chroma.")
else:
    print("No changes detected — nothing to update.")