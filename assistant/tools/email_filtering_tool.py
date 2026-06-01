import os
import json
import traceback
import polars as pl
from ..lib.load_data import df
from collections import defaultdict
from typing import List, Tuple, Dict, Optional, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from ..lib.utils import normalize_list, match_value_in_columns, smart_subject_match, build_date_range, human_readable_date, count_tokens

class EmailFilteringTool:

    llm_model = ChatGoogleGenerativeAI(
        model='gemini-2.5-pro',
        temperature=0.4,
        max_retries=2,
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )

    @staticmethod
    def chunk_items(items: List[Tuple[str, str]], size: int):
        """Yield successive chunks from a list."""
        thread_map = defaultdict(list)
        for thread_id, summary in items:
            thread_map[thread_id].append(summary)

        for thread_id, summaries  in thread_map.items():
            for i in range(0, len(summaries), size):
                chunk = [(thread_id, s) for s in summaries[i:i+size]]
                yield chunk

    @staticmethod
    def hierarchical_summary(summaries: List[Tuple[str, str]], tpm_limit: int =  200000, target_words: int = 1024, chunk_size: int = 10):
        """Summarize a list of summaries hierarchically only if the total tokens exceed tpm_limit."""

        thread_text = [f"threadId:{tid}\nthreadSummary:{summary.strip()}\n" for tid, summary in summaries]
        merged_text = "\n\n".join(thread_text)

        current_tokens = count_tokens(merged_text)
        if current_tokens <= tpm_limit:
            print(f"Total tokens ({current_tokens}) within limit ({tpm_limit}). Skipping hierarchical summarization.")
            return merged_text
        
        print(f"Token count = {current_tokens}, exceeding {tpm_limit}. Starting hierarchical summarization...")

        level = 1
        while True:
            new_summaries:List[Tuple[str, str]] = []
            for group in EmailFilteringTool.chunk_items(summaries, chunk_size):
                if len(group) < 6:
                    merged_content = "\n\n".join([summary for _, summary in group])
                    new_summaries.append((group[0][0],merged_content))
                    continue

                merged = "\n\n".join([summary for _, summary in group])
                response = EmailFilteringTool.llm_model.invoke(input=f"Combine and summarize these summaries into one concise summary (~{target_words} words):\n{merged}")
                new_summaries.append((group[0][0],response.content))
            
            summaries = new_summaries
            thread_text = [f"threadId:{tid}\nthreadSummary:{summary.strip()}\n" for tid, summary in summaries]
            merged_text = "\n\n".join(thread_text)
            current_tokens = count_tokens(merged_text)

            print(f"Level {level}: Tokens after summarization = {current_tokens}")
            if current_tokens <= tpm_limit:
                break

            level+=1
        print(f"Final token count: {current_tokens}")
        return summaries if summaries else ""

    @classmethod
    def run_tool(
        cls, 
        uid: str = None,
        threadId: str = None,
        thread_count: bool = False,
        thread_details: bool = False,
        thread_details_limit: int = 1,
        sender: str = None,
        recipient: str = None,
        subject: str = None,
        cc: bool = False,
        labels: list[str] = None,
        start_date: str = None,
        end_date: str = None,
        body: bool = False,
        html: bool = False,
        sort_by: str = "date_dt",
        sort_order: str = "desc",
        limit: int = 5,
        analysis: Optional[Dict] = None,):
        try:
            print(f"email_filtering_tool is being called {uid}, {threadId}, {thread_count}, {thread_details}, {thread_details_limit}, {sender}, {recipient}, {subject}, {cc}, {labels}, {start_date}, {end_date}, {body}, {html}, {sort_by}, {sort_order}, {limit}, {analysis}")
            ldf = df.clone()

            # Preprocess columns once
            dt1 = pl.col("date").str.to_datetime("%Y-%m-%dT%H:%M:%S", strict=False).dt.replace_time_zone("UTC")
            dt2 = pl.col("date").str.to_datetime("%Y-%m-%dT%H:%M:%S%z", strict=False).dt.convert_time_zone("UTC")

            ldf = ldf.with_columns([
                pl.col("body").struct.field("text").alias("body_text"),
                pl.col("body").struct.field("html").alias("body_html"),
                pl.col("from").map_elements(normalize_list, return_dtype=str).alias("from_normalized"),
                pl.col("to").map_elements(normalize_list, return_dtype=str).alias("to_normalized"),
                pl.col("cc").map_elements(normalize_list, return_dtype=str).alias("cc_normalized"),
                pl.col("labels").map_elements(normalize_list, return_dtype=str).alias("labels_normalized"),
                pl.coalesce([dt1, dt2]).alias("date_dt")
            ])

            mask_expr = pl.lit(True)

            if uid:
                mask_expr = mask_expr & (pl.col("id") == uid)

            if threadId:
                mask_expr = mask_expr & (pl.col("threadId") == threadId)

            if sender:
                sender = sender.lower()
                mask_expr = mask_expr & pl.col("from_normalized").map_elements(lambda x: match_value_in_columns(sender, x), return_dtype=bool)

            if recipient:
                recipient = recipient.lower()
                recipient_mask = pl.col("to_normalized").map_elements(lambda x: match_value_in_columns(recipient, x), return_dtype=bool)
                if cc:
                    cc_mask = pl.col("cc_normalized").map_elements(lambda x: match_value_in_columns(recipient, x), return_dtype=bool)
                    recipient_mask = recipient_mask | cc_mask
                mask_expr = mask_expr & recipient_mask

            if labels: 
                norm_labels = [lbl.strip().lower() for lbl in labels if lbl]
                mask_expr = mask_expr & pl.col("labels_normalized").map_elements(
                    lambda x: any(lbl in (x or "") for lbl in norm_labels),
                    return_dtype=bool
                )

            if subject:   
                pat = subject.strip().lower() 
                mask_expr = mask_expr & pl.col("subject").map_elements(lambda x: smart_subject_match(pat, x or ""), return_dtype=bool)
                
            range_start, range_end = build_date_range(start_date, end_date)
            if range_start:
                mask_expr = mask_expr & (pl.col("date_dt") >= range_start)
            if range_end:
                mask_expr = mask_expr & (pl.col("date_dt") <= range_end)
            
            # Apply the mask only once
            filtered = ldf.filter(mask_expr)

            # Materialize count early (cheap)
            total_matches = filtered.height

            if total_matches == 0:
                return "No emails found matching the specified criteria."

            if analysis:
                analysis_type = analysis.get('analysis_type')
                field = analysis.get('field', "from_normalized")
                top_n = int(analysis.get('top_n', 10))
                sort_order = analysis.get('sort_order', "desc")
                threshold_hours = int(analysis.get('threshold_hours', 24))
                min_delayed = analysis.get('min_delayed_replies')

                if analysis_type == "active_status":
                    # explode the field if it's a comma joined list
                    if field in {"from_normalized", "to_normalized", "cc_normalized", "threadId", "labels_normalized"}:
                        exploded = filtered.with_columns(pl.col(field).str.split(by=", ").alias(field)).explode(field)
                        result = exploded.group_by(field).agg(pl.len().alias("email_count"))
                    else:
                        result = filtered.group_by(field).agg(pl.len().alias("email_count"))
                    result = result.sort("email_count", descending=(sort_order == "desc")).head(top_n)
                    return "\n---\n".join(json.dumps(r, default=str) for r in result.to_dicts())
                
                if analysis_type == "threads_status":
                    df_thread = filtered.group_by(field).agg((pl.col("date_dt").max() - pl.col("date_dt").min()).alias("duration"))
                    if min_delayed:
                        resp = (filtered.sort(["threadId", "date_dt"]).with_columns((pl.col("date_dt").diff().dt.total_seconds() / 3600).alias("hours_diff")))
                        delayed_counts = resp.group_by(field).agg(((pl.col("hours_diff") > threshold_hours).cast(pl.Int64)).sum().alias("delayed_count"))
                        df_thread = df_thread.join(delayed_counts, on=field).filter(pl.col("delayed_count") >= int(min_delayed))
                    df_thread = df_thread.filter(pl.col("duration") > pl.duration(minutes=10)).sort("duration", descending=(sort_order == "desc")).head(int(top_n))
                    return "\n---\n".join(json.dumps(r, default=str) for r in df_thread.to_dicts())
                
                if analysis_type == "response_time":
                    df_resp = filtered.sort(["threadId", "date_dt"]).with_columns(
                        (pl.col("date_dt").diff().over("threadId").dt.total_seconds()).alias("response_time_sec")
                    )
                    df_resp = df_resp.filter(pl.col("response_time_sec").is_not_null() & (pl.col("response_time_sec") > 600))
                    result = df_resp.group_by(field).agg(pl.col("response_time_sec").mean().alias("avg_response_sec"))
                    result = result.sort("avg_response_sec", descending=(sort_order == "desc"))
                    return "\n---\n".join(json.dumps(r, default=str) for r in result.head(top_n).to_dicts())
                
                return f"Unknown analysis_type: {analysis_type}"
            
            filtered = filtered.sort(by=sort_by, descending=(sort_order.lower() == "desc"))

            if thread_count:
                unique_threads_count = filtered.select(pl.col("threadId")).unique().height
                return f"Total unique email threads: {unique_threads_count}"
                
            if thread_details:
                unique_threads_df = filtered.select(pl.col("threadId"), pl.col("date_dt")).unique().sort("date_dt", descending=True)
                unique_threads = [r[0] for r in unique_threads_df.to_series("threadId").to_list()]
                summaries = []
                for tid in unique_threads[:thread_details_limit]:
                    thread_df = filtered.filter(pl.col("threadId") == tid).sort("date_dt", descending=False)
                    emails = thread_df.select(["from", "to", "subject", "snippet", "body_text", "date_dt"]).to_dicts()
                    for email in emails:
                        summaries.append((tid, json.dumps(email, default=str)))

                final_summary = EmailFilteringTool.hierarchical_summary(summaries) if hasattr(EmailFilteringTool, "hierarchical_summary") else "\n".join(summaries[:10])
                return f"Total {len(unique_threads)} threads matching the criteria.\n\nSummary of {min(thread_details_limit, len(summaries))} threads:\n{final_summary}"

            # --- Preview results ---
            preview_cols = ["id", "threadId", "from", "to", "subject", "date_dt", "cc", "snippet", "labels", "attachments"]
            if body:
                preview_cols.append("body_text")
            if html:
                preview_cols.append("body_html")

            effective_limit = limit if limit is not None else 5
            results_preview = filtered.select(preview_cols).head(effective_limit).to_dicts()

            def fmt(res: dict[str, Any]):
                parts = [
                    f"id: {res.get('id','N/A')}",
                    f"ThreadId: {res.get('threadId','N/A')}",
                    f"From: {res.get('from','N/A')}",
                    f"To: {res.get('to','N/A')}",
                    f"CC: {res.get('cc','N/A')}",
                    f"Subject: {res.get('subject','N/A')}",
                    f"Date: {human_readable_date(res.get('date_dt'))}",
                    f"Snippet: {res.get('snippet','N/A')}",
                    f"Labels: {res.get('labels','N/A')}",
                    f"Attachments: {res.get('attachments','N/A')}",
                ]
                if body:
                    parts.append(f"Body: {res.get('body_text','N/A')}")
                if html:
                    parts.append(f"HTML: {res.get('body_html','N/A')}")
                return "\n".join(parts)
            
            formatted_results = "\n\n---\n\n".join(fmt(r) for r in results_preview)
            shown = min(int(effective_limit), int(total_matches))

            return f"Found {int(total_matches)} emails matching the criteria. Showing {shown}:\n\n{formatted_results}"
        
        except Exception as e:
            err_payload = {"error": str(e), "traceback": traceback.format_exc()}
            print(f"\033[91m{err_payload}\033[0m")
            return "\n\n---".join(json.dumps(err_payload))