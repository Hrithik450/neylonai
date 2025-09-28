from pydantic import BaseModel, validator
from .utils import report 
from typing import List
import torch
import gc

report("before transformers import", ) 
from transformers import AutoTokenizer, AutoModelForSequenceClassification, BitsAndBytesConfig
import torch
report("after transformers import")

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
    model = None
    tokenizer = None

    @classmethod
    def load_model(cls):
        if cls.model is None or cls.tokenizer is None:
            # 4-bit quantization settings
            try:
                bnb_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_quant_type="nf4",   
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_compute_dtype="bfloat16" 
                )

                cls.model = AutoModelForSequenceClassification.from_pretrained(cls.model_name, quantization_config=bnb_config, dtype=torch.float16)
                cls.model.eval() 

                cls.tokenizer = AutoTokenizer.from_pretrained(cls.model_name)
                report("after loading model")
            except Exception as e:
                print(f"error: {str(e)}")
        return cls.model, cls.tokenizer

    @classmethod
    def encode(cls, data: EncoderRequest):
        try:
            req = EncoderRequest(**data)
            model, tokenizer = cls.load_model()

            # Tokenize query-text pairs
            features = tokenizer(
                req.queries,
                req.texts,
                padding=True,
                truncation=True,
                return_tensors="pt"
            )
            report("after implementing features")

            # Forward pass
            with torch.no_grad():
                output = model(**features)
            report("after model forward pass")

            # Convert logits to list
            logits_list = output.logits.tolist()

            report("after logits_list")
            del features, output
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            return {"success": True, "data": {"list": logits_list}}
        except Exception as e:
            return {"success": False, "error": str(e)}