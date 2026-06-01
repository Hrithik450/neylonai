from ..lib.utils import AGENT_MODEL, EMBEDDING_MODEL_NAME
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from ..lib.load_data import chroma_collection
from typing import Optional, List, Any
from dataclasses import dataclass
from functools import lru_cache
import concurrent.futures
import threading
import datetime
import logging
import atexit
import os

logging.basicConfig(level=logging.INFO)

@dataclass
class Response:
    success: bool
    data: Optional[List[Any]]
    error: Optional[str]

class ThreadPoolService:
    _executor = None
    _lock = threading.Lock()

    @classmethod
    def get_executor(cls):
        if cls._executor is None:
            with cls._lock:
                if cls._executor is None:
                    cls._executor = concurrent.futures.ThreadPoolExecutor(max_workers=16)
                    atexit.register(cls.shutdown_executor)
        return cls._executor
    
    @classmethod
    def shutdown_executor(cls):
        with cls._lock:
            if cls._executor:
                cls._executor.shutdown()
                cls._executor = None

class Utility:
    @staticmethod
    @lru_cache(maxsize=1)
    def get_embedding_model():
        return OpenAIEmbeddings(model=EMBEDDING_MODEL_NAME, api_key=os.getenv("OPENAI_API_KEY"))
    
    @staticmethod
    @lru_cache(maxsize=1)
    def get_query_expansion_chain():
        query_expansion_prompt = """You are an AI language model assistant. Your task is to generate 3 
        different versions of the given user question to retrieve relevant documents from a vector 
        database. By generating multiple perspectives on the user question, your goal is to help
        the user overcome some of the limitations of the distance-based similarity search. 
        Provide these alternative questions separated by newlines. Original question: {question}"""

        prompt_perspectives = ChatPromptTemplate.from_template(query_expansion_prompt)

        return (
            prompt_perspectives
            | ChatOpenAI(model=AGENT_MODEL, temperature=0.4)
            | StrOutputParser()
            | (lambda x: x.split("\n"))
        )

class SemanticSearchTool:
    """
    Semantic search tool.
    This class reuses a global thread pool and shared model resources efficiently.
    """
    @staticmethod
    def process_single_query(q: str, batch_no: int):
        try:
            thread_name = threading.current_thread().name
            logging.info(f"{datetime.datetime.now()} - Start batch {batch_no} on {thread_name}")

            embedding_model = Utility.get_embedding_model()
            embedding = embedding_model.embed_query(q)

            results = chroma_collection.query(query_embeddings=[embedding])

            logging.info(f"{datetime.datetime.now()} - End batch {batch_no} on {thread_name}")
            return Response(success=True, data=results)
        
        except Exception as e:
            logging.exception("Error in process_query")
            return Response(success=False, error=f"Error in process_query: {e}")

    @staticmethod
    def semantic_search(query: str):
        try:
            logging.info(f'semantic_search_tool is being called with {query}')
        
            if chroma_collection is None:
                logging.error("ChromaDB connection is not available")
                return "Error: ChromaDB connection is not available."

            generator = Utility.get_query_expansion_chain()
            executor = ThreadPoolService.get_executor()

            expanded_queries = generator.invoke({"question": query})[:3]
            logging.info(f"Expanded queries: {expanded_queries}")

            futures = {
                executor.submit(SemanticSearchTool.process_single_query, q, i) : i for i, q in enumerate(expanded_queries)
            }

            results = []

            for future in concurrent.futures.as_completed(futures):
                batch_no = futures[future]

                try:
                    response = future.result(timeout=10)

                    if not response.success:
                        logging.warning(f"Batch {batch_no} failed: {response.error}")
                        continue

                    results.extend(response.data)

                except Exception:
                    logging.exception(f"Future excecution failed for batch {batch_no}")

            if not results:
                logging.info("No relavant documents found")
                return "No relevant documents found"
            
            logging.info(f"Returning {len(results)} results.")

            return "\n\n---\n\n".join(results)
        
        except Exception as e:
            logging.exception(f"semantic_search failed: {e}")
            return "Internal server error"