# from optimum.onnxruntime import ORTQuantizer
# from optimum.onnxruntime.configuration import AutoQuantizationConfig

# model_dir = "onnx_cross_encoder"
# quantized_dir = "onnx_cross_encoder_int8"

# quantizer = ORTQuantizer.from_pretrained(model_dir)
# dqconfig = AutoQuantizationConfig.avx512_vnni(is_static=False)
# quantizer.quantize(save_dir=quantized_dir, quantization_config=dqconfig)

# import numpy as np
# import onnxruntime as ort
# from transformers import AutoTokenizer

# model_path = "onnx_cross_encoder_int8/model_quantized.onnx"
# tokenizer = AutoTokenizer.from_pretrained("cross-encoder/ms-marco-MiniLM-L-6-v2")
# session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])

# query  = "How many people live in Berlin?"
# text   = "New York City is famous for the Metropolitan Museum of Art."

# tokens = tokenizer(
#     query,
#     text,
#     padding=True,
#     truncation=True,
#     return_tensors="np"
# )

# onnx_inputs = {
#     "input_ids": tokens["input_ids"],
#     "attention_mask": tokens["attention_mask"],
# }
# if "token_type_ids" in tokens:
#     onnx_inputs["token_type_ids"] = tokens["token_type_ids"]

# outputs = session.run(None, onnx_inputs)
# logits = outputs[0]

# print("Logits:", logits)
# print("Predicted score:", float(logits[0][0]))