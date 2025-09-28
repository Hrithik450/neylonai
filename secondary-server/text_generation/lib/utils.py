from rapidfuzz import fuzz, process
from datetime import datetime, timezone
from pathlib import Path
import polars as pl
import psutil
import os
import re

BASE_DIR = Path(os.path.dirname(__file__))  # current file directory
EMAIL_JSON_PATH = BASE_DIR / "data" / "all_mails.jsonl"
EMBEDDING_MODEL_NAME = "text-embedding-3-large"
CHROMA_COLLECTION_NAME = "organization_data"
AGENT_MODEL = "gpt-4.1" # Or another powerful model like "gpt-4-turbo"

process = psutil.Process(os.getpid())

def report(step, base):
    rss = process.memory_info().rss / 1024**2  # MB
    delta = rss - base
    print(f"{step:<35} Total: {rss:7.2f} MB | +{delta:6.2f} MB")
    return rss
# mem = report("after chroma_collection", mem)

# Helper functions
def format_date(d):
    if isinstance(d, datetime):
        return d.strftime('%Y-%m-%d %H:%M:%S')
    elif isinstance(d, str):
        return d
    return 'N/A'

def normalize_email_field(*values):
    """Normalize one or more email fields into clean lowercase emails."""
    normalized_emails = []
    
    for value in values:
        # Polars Series safe check
        if isinstance(value, pl.Series):
            if value.is_empty():
                continue
            value = value.to_list()

        if not value:
            continue

        if isinstance(value, list):
            for v in value:
                cleaned = re.sub(r'[\"\'<>]', '', v)
                normalized_emails.append(cleaned.strip().lower())
        else:
            cleaned = re.sub(r'[\"\'<>]', '', value)
            normalized_emails.append(cleaned.strip().lower())

    return normalized_emails

def match_value_in_columns(value, column_value):
    """
    Check if the global `value` matches any entry in `column_value (from, to, cc)`.

    Matching rules:
      1. If `column_value` is a list → check each item.
      2. If `column_value` is a string → check directly.
      3. A match is considered valid if:
            - `sender` is an exact substring, OR
            - fuzzy string similarity (partial_ratio) > 50.
      4. If no match found or input invalid → return False.
    """
    if not isinstance(value, str) or not value:
        return False

    # Case 1: column_value is a list
    if isinstance(column_value, list):
        for e in column_value:
            if value in e or fuzz.partial_ratio(value.lower(), e.lower()) > 80:
                return True
        return False

    # Case 2: column_value is a string
    if isinstance(column_value, str):
        return value in column_value or fuzz.partial_ratio(value.lower(), column_value.lower()) > 80

    return False

# Normalize the lists to string to apply filters
def normalize_list(lst) -> str:
    normalized = []

    if isinstance(lst, list):
        for i in lst:
            val = normalize_email_field(i)
            if isinstance(val, list):
                normalized.extend(map(str, val))  # flatten if list
            elif val is not None:
                normalized.append(str(val))

    elif lst is not None:
        val = normalize_email_field(lst)
        if isinstance(val, list):
            normalized.extend(map(str, val))
        elif val is not None:
            normalized.append(str(val))

    return ",".join(normalized)

# Helper to safely extract values
def safe_get(row, key, default=""):
    value = row.get(key, default) if isinstance(row, dict) else row[key]
    if value is None or str(value).lower() in {"nan", "none"}:
        return default
    return str(value)

def preprocess_subject(subject: str) -> str:
    if not isinstance(subject, str):
        return ""
    # Lowercase and replace symbols with space
    subject = re.sub(r'[:\-_,]', ' ', subject)
    subject = re.sub(r'\s+', ' ', subject)  # normalize spaces
    return subject.lower().strip()

def extract_numbers(text: str) -> set[str]:
    return set(re.findall(r'\b\d+\b', text))

def smart_subject_match(user_value: str, column_value: str) -> bool:
    if not column_value:
        return False
    
    user_clean = preprocess_subject(user_value)
    col_clean = preprocess_subject(column_value)

    user_nums = extract_numbers(user_clean)
    col_nums = extract_numbers(col_clean)

    # --- Number must match if present ---
    if user_nums and not (user_nums & col_nums):
        return False

    # --- Fuzzy match on remaining text ---
    fuzz_score = fuzz.token_set_ratio(user_clean, col_clean) / 100

    if user_nums:
        # numbers match → relax threshold
        return fuzz_score >= 0.65
    else:
        # no numbers → require stricter match
        return fuzz_score >= 0.85


def parse_datetime_utc_flexible(date_str: str) -> datetime:
    """Parse various date/time formats into a UTC-aware datetime."""
    try:
        dt = datetime.fromisoformat(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except ValueError:
        pass
    raise ValueError(f"Cannot parse date: {date_str}")

def expand_start(dt: datetime, original_str: str) -> datetime:
    """Expand start bound depending on precision."""
    if len(original_str) == 10:       # YYYY-MM-DD
        return dt.replace(hour=0, minute=0, second=0)
    else:                             # exact second
        return dt

def expand_end(dt: datetime, original_str: str, start_date: str) -> datetime:
    """Expand end bound depending on precision."""
    if len(original_str) == 10:       # YYYY-MM-DD
        return dt.replace(hour=23, minute=59, second=59)
    elif len(original_str) == 16:
        return dt.replace(second=59)
    elif len(original_str) == 19:
        if original_str == start_date:
            if original_str.endswith("00:00"):
                return dt.replace(minute=59, second=59)
            else:
                return dt.replace(second=59)
        return dt  # YYYY-MM-DD HH:MM
    return dt

def build_date_range(start_date: str, end_date: str):
    """Return (range_start, range_end) that always forms a valid interval."""
    if not start_date and not end_date:
        return None, None
    
    range_start = parse_datetime_utc_flexible(start_date) if start_date else None
    range_end = parse_datetime_utc_flexible(end_date) if end_date else None

    if range_start:
        range_start = expand_start(range_start, start_date)
    if range_end:
        range_end = expand_end(range_end, end_date, start_date)

    print(range_start, range_end)

    return range_start, range_end