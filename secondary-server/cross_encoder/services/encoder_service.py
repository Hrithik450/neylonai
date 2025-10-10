from pydantic import BaseModel, validator, ValidationError
from transformers import AutoTokenizer
from typing import List, Optional
from ..lib.utils import report 
import onnxruntime as ort
import numpy as np

class EncoderRequest(BaseModel):
    queries: List[str]
    texts: List[str]

    @validator("texts")
    def check_equal_length(cls, v, values):
        if "queries" in values and len(values["queries"]) != len(v):
            raise ValueError("queries and texts must be arrays of equal length")
        return v

class EncoderResponse(BaseModel):
    success: bool
    data: Optional[List] = None
    error: Optional[str] = None

class EncoderService:
    tokenizer_path = "onnx_cross_encoder_int8"
    model_path = "onnx_cross_encoder_int8/model_quantized.onnx"
    tokenizer = None
    session = None

    @classmethod
    def load_model(cls):
        if cls.tokenizer is None:
            cls.tokenizer = AutoTokenizer.from_pretrained(cls.tokenizer_path)
        
        if cls.session is None:
            cls.session = ort.InferenceSession(cls.model_path, providers=["CPUExecutionProvider"])
        return cls.session, cls.tokenizer

    @classmethod
    def encode(cls, data: EncoderRequest) -> EncoderResponse:
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
            return EncoderResponse(success=True, data=np.array(logits, dtype=np.float32), error=None)

        except ValidationError as ve:
            return EncoderResponse(success=False, data=None, error=f"Validation error: {str(ve)}")
        except Exception as e:
            return EncoderResponse(success=False, data=None, error=f"Error occured: {str(e)}")