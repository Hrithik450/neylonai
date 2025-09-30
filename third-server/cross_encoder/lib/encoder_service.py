from pydantic import BaseModel, validator
from transformers import AutoTokenizer
import onnxruntime as ort
from .utils import report 
from typing import List
import numpy as np
import gc

class EncoderRequest(BaseModel):
    queries: List[str]
    texts: List[str]

    @validator("texts")
    def check_equal_length(cls, v, values):
        if "queries" in values and len(values["queries"]) != len(v):
            raise ValueError("queries and texts must be arrays of equal length")
        return v

class EncoderService:
    model_name = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    model_path = "onnx_cross_encoder_int8/model_quantized.onnx"
    tokenizer = None
    session = None

    @classmethod
    def load_model(cls):
        if cls.tokenizer is None:
            cls.tokenizer = AutoTokenizer.from_pretrained(cls.model_name)
        
        if cls.session is None:
            cls.session = ort.InferenceSession(cls.model_path, providers=["CPUExecutionProvider"])
        return cls.session, cls.tokenizer

    @classmethod
    def encode(cls, data: EncoderRequest):
        try:    
            req = EncoderRequest(**data)
            session, tokenizer = cls.load_model()

            # Tokenize query-text pairs
            tokens = tokenizer(
                req.queries,
                req.texts,
                padding=True,
                truncation=True,
            )
            onnx_inputs = {k: np.array(v, dtype=np.int64) for k, v in tokens.items()}

            # Inputs
            logits = session.run(None, onnx_inputs)[0]
            report("after implementing features")

            # Convert logits to list
            logits_np = np.array(logits, dtype=np.float32)

            report("after logits_list")
            del logits, onnx_inputs, tokens
            gc.collect()

            yield {"success": True, "data": {"list": logits_np}}

            del logits_np
            gc.collect()
        except Exception as e:
            return {"success": False, "error": str(e)}