from ..lib.utils import AGENT_MODEL, EMBEDDING_MODEL_NAME, report
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain.prompts import ChatPromptTemplate
from ..lib.load_data import chroma_collection
from rank_bm25 import BM25Okapi
import concurrent.futures
import numpy as np
import traceback
import threading
import datetime
import requests
import json
import os

class SemanticSearchTool:
    """
    Semantic search tool using BM25 + Dense Embeddings + Cross-Encoder Reranking.
    This class reuses a global thread pool and shared model resources efficiently.
    """
    thread_pool_excecutor = concurrent.futures.ThreadPoolExecutor(max_workers=16)
    encoder_api_url = os.getenv("ENCODER_API_URL")

    def __init__(self):
        """Initialize all heavy resources only once."""
        try:
            print("Initializing semantic search tool...")
            # 1. Embedding function with batching ---
            self.embedding_model = OpenAIEmbeddings(model=EMBEDDING_MODEL_NAME, api_key=os.getenv("OPENAI_API_KEY"))

            # 2. BM25 (An superfast algo which focus more on imp key words to retrieve relavant docs) - will need documents loaded once
            if chroma_collection is not None:
                all_chroma = chroma_collection.get(include=["documents", "metadatas"])
                documents  = all_chroma["documents"]
                metadatas  = all_chroma["metadatas"]

                # Pre-tokenize for BM25
                self.tokenized_docs = [doc.lower().split() for doc in documents]

                # mem = report("After tokenizing docs (consider batching here if docs are large)", 0)
                self.bm25 = BM25Okapi(self.tokenized_docs)
                self.doc_to_index = {doc: i for i, doc in enumerate(documents)}
                self.index_to_doc = {i:doc for doc, i in self.doc_to_index.items()}
                self.doc_to_meta = {doc: (meta if meta is not None else {}) for doc, meta in zip(documents, metadatas or [{}]*len(documents))}
                # mem = report("After BM25 init and mapping dicts (large dicts can consume memory)", mem)
            
            # 3. Query expansion pipeline
            template = """You are an AI language model assistant. Your task is to generate 3 
            different versions of the given user question to retrieve relevant documents from a vector 
            database. By generating multiple perspectives on the user question, your goal is to help
            the user overcome some of the limitations of the distance-based similarity search. 
            Provide these alternative questions separated by newlines. Original question: {question}"""
            self.prompt_perspectives = ChatPromptTemplate.from_template(template)

            self.generate_queries = (
                self.prompt_perspectives 
                | ChatOpenAI(model=AGENT_MODEL, temperature=0) 
                | StrOutputParser() 
                | (lambda x: x.split("\n"))
            )
            print("Initialized semantic search tool.")

        except Exception as e:
            err_payload = {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            print(f"\033[91m{err_payload}\033[0m")
            return err_payload

    def process_query(self, q: str, batch_no: int):
        try:
            """Process one query using BM25 and dense embeddings."""
            all_results, metadata_results = [], []
            # mem = report("Starting process_query", 0)

            thread_name = threading.current_thread().name
            print(f"{datetime.datetime.now()} - Start batch {batch_no} on {thread_name}")

            bm25_scores = self.bm25.get_scores(q.lower().split())
            bm25_scores = np.array(bm25_scores) / (np.max(bm25_scores)+1e-6)
            # mem = report("After BM25 scoring", mem)

            top_bm25_indices = np.argsort(bm25_scores)[::-1]
            top_bm25_docs = []
            for idx in top_bm25_indices:
                score = bm25_scores[idx]
                if score > 0 and idx in self.index_to_doc:
                    top_bm25_docs.append((self.index_to_doc[idx], score))
            # mem = report("After selecting top BM25 docs", mem)

            # Dense embedding + vector search
            query_embedding = self.embedding_model.embed_query(q)
            # mem = report("After embedding query", mem)

            search_results = chroma_collection.query(query_embeddings=[query_embedding])
            # Chroma returns lists inside lists (one per query)
            sem_docs = search_results["documents"][0]
            sem_scores = search_results["distances"][0]
            sem_metadata = search_results["metadatas"][0]

            for i, doc in enumerate(sem_docs):
                bm25_index = self.doc_to_index.get(doc, None)
                bm25_score = bm25_scores[bm25_index] if bm25_index is not None else 0
                dense_score = sem_scores[i]
                combined_score = 0.5 * bm25_score + 0.5 * dense_score

                # check if email_id is present inside metadata
                meta_item = sem_metadata[i] if i < len(sem_metadata) else {}
                email_id = meta_item.get("email_id") if isinstance(meta_item, dict) else None

                if doc.startswith("Metadata:"):
                    metadata_results.append((doc, email_id, combined_score))
                else:
                    all_results.append((doc, email_id, combined_score))
            # mem = report("After combining dense & BM25 results", mem)

            # Add BM25-only docs
            for doc, bm25_score in top_bm25_docs:
                if doc.startswith("Metadata:"):
                    metadata_results.append((doc, self.doc_to_meta.get(doc, {}).get("email_id") if doc in self.doc_to_meta else None, bm25_score))
                    continue

                if doc not in sem_docs:
                    email_id = self.doc_to_meta[doc].get("email_id") if doc in self.doc_to_meta else None
                    all_results.append((doc, email_id, bm25_score))
            # mem = report("After adding BM25-only docs", mem)

            print(f"{datetime.datetime.now()} - End batch {batch_no} on {thread_name}")
            return {"success": True, "data": [all_results, metadata_results]}
        
        except Exception as e:
            err_payload = {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            print(f"\033[91m{err_payload}\033[0m")
            return err_payload

    def run_tool(self, query: str):
        try:
            print(f'semantic_search_tool is being called with {query}')
        
            # --- CHANGED: Query ChromaDB---
            # We now query Chroma to get the most relevant documents.
            if chroma_collection is None:
                return "Error: ChromaDB connection is not available."

            # 2. Expand into multiple queries
            expanded_queries = self.generate_queries.invoke(input={"question": query})

            all_results = []
            metadata_results = []
            mem = report("After query expansion", 0)

            # 2. For each expanded query, embed and fetch document
            for response in concurrent.futures.as_completed({SemanticSearchTool.thread_pool_excecutor.submit(self.process_query, q, i): i for i, q in enumerate(expanded_queries, start=0)}):
                result = response.result()
                if not result.get("success"):
                    err_payload = result.get("error")
                    print(f"\033[91m{err_payload}\033[0m")
                    return "\n\n---".join(json.dumps(err_payload))
                
                docs, metadatas = result.get("data")
                all_results.extend(docs)
                metadata_results.extend(metadatas)

            # Deduplicate (get_unique_union effect)
            unique_results = {}
            for doc, email_id, score in all_results:
                if doc not in unique_results or score > unique_results[doc]["score"]:
                    unique_results[doc] = {"email_id": email_id, "score": score}

            # Deduplicate metadata docs separately
            unique_metadata = {}
            for doc, email_id, score in metadata_results:
                if doc not in unique_metadata or score > unique_metadata[doc]["score"]:
                    unique_metadata[doc] = {"email_id": email_id, "score": score}
            
            top_chunks = sorted(unique_results.items(), key=lambda x:x[1]["score"], reverse=True)
            top_metadata = sorted(unique_metadata.items(), key=lambda x: x[1]["score"], reverse=True) 
            mem = report("After deduplicating top chunks", mem)

            # Re-ranking with Cross-Encoder
            queries, texts = [], []
            for doc, _ in top_chunks:
                queries.append(query)
                texts.append(doc)

            if not SemanticSearchTool.encoder_api_url:
                raise RuntimeError("Please add ENCODER_API_URL in env variables")    
            
            response = requests.post(SemanticSearchTool.encoder_api_url, json={"queries": queries, "texts": texts}, stream=True)
            result = response.json()
            if not result.get('success'):
                err_payload = result.get("error")
                print(f"\033[91m{err_payload}\033[0m")
                return "\n\n---".join(json.dumps(err_payload))
            
            rerank_scores = result['data']
            ranked = sorted(zip(rerank_scores, top_chunks), key=lambda x: x[0], reverse=True)

            # Combine final results: top 10 main docs, then all metadata as low-priority
            results_for_llm = []
            for _, (doc, meta) in ranked:
                email_id = meta.get("email_id") if isinstance(meta, dict) else None
                if email_id:
                    results_for_llm.append(f"[id: {email_id}]\n{doc}")
                else:
                    results_for_llm.append(doc)

            threshold = 50
            for doc, meta in top_metadata[:25]:
                if meta["score"] < threshold:
                    continue
                email_id = meta.get("email_id") if isinstance(meta, dict) else None
                if email_id:
                    results_for_llm.append(f"[id: {email_id}]\n{doc}")
                else:
                    results_for_llm.append(doc)

            mem = report("Before return final results", mem)
            return "\n\n---\n\n".join(results_for_llm) if results_for_llm else "No relevant documents found."
        
        except Exception as e:
            err_payload = {"error": str(e), "traceback": traceback.format_exc()}
            print(f"\033[91m{err_payload}\033[0m")
            return "\n\n---".join(json.dumps(err_payload))