import os
import sys
import psutil
from typing import List

process = psutil.Process(os.getpid())

# def report(step: str, base: float = 0.0) -> float:
#     rss = process.memory_info().rss / 1024**2  # MB
#     delta = rss - base
#     print(f"{step:<35} Total: {rss:7.2f} MB | +{delta:6.2f} MB")
#     return rss

def report(label=""):
    process = psutil.Process(os.getpid())
    mem = process.memory_info().rss / 1024 / 1024  # in MB
    print(f"[MEM] {label}: {mem:.2f} MB")

def batchify(queries: List[str], texts: List[str], tokenizer, max_tokens: int = 5120):
    """
    Split queries/texts into batches so each batch <= max_tokens.
    This prevents memory spike.
    """
    batches = []
    current_q, current_t = [], []
    current_tokens = 0

    for q, t in zip(queries, texts):
        # Rough token count
        num_tokens = len(tokenizer.encode(q)) + len(tokenizer.encode(t))
        if current_tokens + num_tokens > max_tokens and current_q:
            batches.append((current_q, current_t))
            current_q, current_t, current_tokens = [], [], 0

        current_q.append(q)
        current_t.append(t)
        current_tokens += num_tokens

    if current_q:
        batches.append((current_q, current_t))
    return batches