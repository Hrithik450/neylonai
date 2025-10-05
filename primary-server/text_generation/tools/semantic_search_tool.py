from langchain.tools import tool
from ..lib.load_data import chroma_collection # <-- 1. IMPORT THE CORRECT EMBEDDING CLIENT
from ..lib.utils import AGENT_MODEL, EMBEDDING_MODEL_NAME, report
from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain.prompts import ChatPromptTemplate
from rank_bm25 import BM25Okapi
import numpy as np
import requests
import json
import os

# --- Heavy initializations ---
# 1. Embedding function with batching ---
embedding_model = OpenAIEmbeddings(model=EMBEDDING_MODEL_NAME, api_key=os.getenv("OPENAI_API_KEY"))

# 2. BM25 (An superfast algo which focus more on imp key words to retrieve relavant docs) - will need documents loaded once
if chroma_collection is not None:
    # Load chunks from chroma
    all_chroma = chroma_collection.get(include=["documents", "metadatas"])
    documents  = all_chroma["documents"]
    metadatas  = all_chroma["metadatas"]
    # Pre-tokenize for BM25
    tokenized_docs = [doc.lower().split() for doc in documents]
    mem = report("After tokenizing docs (consider batching here if docs are large)", 0)

    bm25 = BM25Okapi(tokenized_docs)
    # Mapping: doc text -> index
    doc_to_index = {doc: i for i, doc in enumerate(documents)}
    index_to_doc = {i: doc for doc, i in doc_to_index.items()}
    doc_to_meta = {doc: (meta if meta is not None else {}) for doc, meta in zip(documents, metadatas or [{}]*len(documents))}
    mem = report("After BM25 init and mapping dicts (large dicts can consume memory)", mem)
else:
    documents = []
    tokenized_docs = []
    bm25 = None

# 4. Query expansion pipeline
template = """You are an AI language model assistant. Your task is to generate 3 
different versions of the given user question to retrieve relevant documents from a vector 
database. By generating multiple perspectives on the user question, your goal is to help
the user overcome some of the limitations of the distance-based similarity search. 
Provide these alternative questions separated by newlines. Original question: {question}"""
prompt_perspectives = ChatPromptTemplate.from_template(template)

generate_queries = (
    prompt_perspectives 
    | ChatOpenAI(model=AGENT_MODEL, temperature=0) 
    | StrOutputParser() 
    | (lambda x: x.split("\n"))
)

# --- Utility ---
def normalize_scores(scores):
    arr = np.array(scores)
    return arr / (np.max(arr) + 1e-6)

# --- Worker function for each expanded query ---
def process_query(q, bm25, doc_to_index, index_to_doc, doc_to_meta):
    results = []

    # BM25
    bm25_scores = bm25.get_scores(q.lower().split())
    bm25_scores = normalize_scores(bm25_scores)
    top_bm25_indices = np.argsort(bm25_scores)[::-1]

    # Dense embedding
    query_embedding = embedding_model.embed_query(q)
    search_results = chroma_collection.query(query_embeddings=[query_embedding])
    sem_docs = search_results["documents"][0]
    sem_scores = search_results["distances"][0]
    sem_metadata = search_results["metadatas"][0]

    # Combine results
    for i, doc in enumerate(sem_docs):
        bm25_index = doc_to_index.get(doc, None)
        bm25_score = bm25_scores[bm25_index] if bm25_index is not None else 0
        dense_score = sem_scores[i]
        combined_score = 0.5 * bm25_score + 0.5 * dense_score
        meta_item = sem_metadata[i] if i < len(sem_metadata) else {}
        email_id = meta_item.get("email_id") if isinstance(meta_item, dict) else None
        results.append((doc, email_id, combined_score))

    # Add BM25-only docs
    for i in top_bm25_indices[:100]:  # limit top 100 for speed
        doc = index_to_doc[i]
        if doc not in sem_docs:
            email_id = doc_to_meta[doc].get("email_id") if doc in doc_to_meta else None
            results.append((doc, email_id, bm25_scores[i]))

    return results

# --- Main Semantic Search Tool ---
@tool("semantic_search_tool", parse_docstring=True)
def semantic_search_tool(query: str) -> str:
    """
    This tool performs a semantic search over the documents to retrieve 
    the most relevant chunks based on user asked query.
    
    Args:
        query (str): The natural language query.

    Returns:
        str: Top 10 most relavent documents with data.
    """
    print(f'semantic_search_tool is being called with {query}')
    mem = report("Function start", 922)
    
    # --- CHANGED: Query ChromaDB---
    # We now query Chroma to get the most relevant documents.
    if chroma_collection is None:
        return "Error: ChromaDB connection is not available."

    # 2. Expand into multiple queries
    expanded_queries = generate_queries.invoke({"question": query})
    print(f"Expanded into {len(expanded_queries)} queries: {expanded_queries}")
    mem = report("After query expansion", mem)

    # 2. For each expanded query, embed and fetch document
    all_results = []
    with ThreadPoolExecutor(max_workers=min(4, len(expanded_queries))) as executor:
        futures = [executor.submit(process_query, q, bm25, doc_to_index, index_to_doc, doc_to_meta)
                   for q in expanded_queries]
        for future in as_completed(futures):
            results, _ = future.result()
            all_results.extend(results)

    # Deduplicate (get_unique_union effect)
    unique_results = {}
    for doc, email_id, score in all_results:
        if doc not in unique_results or score > unique_results[doc]["score"]:
            unique_results[doc] = {"email_id": email_id, "score": score}
    
    top_chunks = sorted(unique_results.items(), key=lambda x: x[1]["score"], reverse=True)[:100]
    mem = report("After deduplicating top chunks", mem)

    # Re-ranking with Cross-Encoder
    queries, texts = [], []
    for doc, _ in top_chunks:
        queries.append(query)
        texts.append(doc)

    ENCODER_API_URL = os.getenv('ENCODER_API_URL')
    if not ENCODER_API_URL:
        raise ValueError("Please set ENCODER_API_URL in environment variables")

    payload = {"queries": queries, "texts": texts}
    with requests.post(ENCODER_API_URL, json=payload, stream=True) as response:
        if response.status_code != 200:
            raise RuntimeError(f"Cross-encoder API failed: {response.text}")

        rerank_scores = []

        # Read the response line by line
        for line in response.iter_lines():
            if not line:
                continue
            batch_result = json.loads(line.decode('utf-8'))
            if not batch_result.get("success"):
                raise RuntimeError(f"Cross-encoder error: {batch_result.get('error')}")
            
            print(len(rerank_scores))
            rerank_scores.extend(batch_result["batch"])
    ranked = sorted(zip(rerank_scores, top_chunks), key=lambda x: x[0], reverse=True)

    # Combine final results: top 10 main docs, then all metadata as low-priority
    results_for_llm = []
    for _, (doc, meta) in ranked:
        email_id = meta.get("email_id") if isinstance(meta, dict) else None
        if email_id:
            results_for_llm.append(f"[id: {email_id}]\n{doc}")
        else:
            results_for_llm.append(doc)

    mem = report("Before return final results", mem)
    return "\n\n---\n\n".join(results_for_llm) if results_for_llm else "No relevant documents found."