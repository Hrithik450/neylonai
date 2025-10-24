from ..lib.utils import AGENT_MODEL, EMBEDDING_MODEL_NAME
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain.prompts import ChatPromptTemplate
from ..lib.load_data import chroma_collection
import concurrent.futures
import traceback
import threading
import datetime
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
            
            # 2. Query expansion pipeline
            template = """You are an AI language model assistant. Your task is to generate 2 
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
        """Process one query using BM25 and dense embeddings."""
        try:
            thread_name = threading.current_thread().name
            print(f"{datetime.datetime.now()} - Start batch {batch_no} on {thread_name}")

            embedding = self.embedding_model.embed_query(q)

            results = chroma_collection.query(query_embeddings=[embedding])
            sem_docs = results["documents"][0]
            sem_scores = results["distances"][0]
            data = []
            
            for doc, score in zip(sem_docs, sem_scores):
                data.append((doc, float(score)))

            print(f"{datetime.datetime.now()} - End batch {batch_no} on {thread_name}")
            return {"success": True, "data": data}
        
        except Exception as e:
            err_payload = {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            print(f"\033[91m{err_payload}\033[0m")
            return err_payload

    def run_tool(self, query: str):
        try:
            print(f'semantic_search_tool is being called with {query}')
        
            if chroma_collection is None:
                return "Error: ChromaDB connection is not available."

            # 1. Expand into multiple queries
            expanded_queries = self.generate_queries.invoke(input={"question": query})[:2]

            all_results = []
            # 2. For each expanded query, embed and fetch document
            for response in concurrent.futures.as_completed({SemanticSearchTool.thread_pool_excecutor.submit(self.process_query, q, i): i for i, q in enumerate(expanded_queries, start=0)}):
                result = response.result(timeout=10)
                if not result.get("success"):
                    err_payload = result.get("error")
                    print(f"\033[91m{err_payload}\033[0m")
                    return "\n\n---".join(json.dumps(err_payload))
                all_results.extend(result['data'])

            # 3. Deduplicate (get_unique_union effect)
            unique_results = {}
            for doc, score in all_results:
                if doc not in unique_results or score > unique_results[doc]:
                    unique_results[doc] = score

            top_docs = sorted(unique_results.items(), key=lambda x: x[1], reverse=False)
            results_for_llm = [doc for doc, _ in top_docs[:10]]

            return "\n\n---\n\n".join(results_for_llm) if results_for_llm else "No relevant documents found."
        
        except Exception as e:
            err_payload = {"error": str(e), "traceback": traceback.format_exc()}
            print(f"\033[91m{err_payload}\033[0m")
            return "\n\n---".join(json.dumps(err_payload))