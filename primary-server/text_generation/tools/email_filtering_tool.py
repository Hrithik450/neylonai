import os
import json
import traceback
import polars as pl
from ..lib.load_data import df
from typing import List, Tuple
from collections import defaultdict
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
        thread_details_limit: int = None,
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
        limit: int = None,):
        try:
            print(f"email_filtering_tool is being called {uid}, {threadId}, {thread_count}, {thread_details}, {thread_details_limit}, {sender}, {recipient}, {subject}, {cc}, {labels}, {start_date}, {end_date}, {body}, {html}, {sort_by}, {sort_order}, {limit}")
            temp_df = df.clone()
            mask = pl.lit(True)

            temp_df = temp_df.with_columns([
                temp_df["body"].struct.field("text").alias("body_text"),
                temp_df["body"].struct.field("html").alias("body_html"),
            ])

            if uid:
                mask = mask & (pl.col("id") == uid)

            if threadId:
                mask = mask & (pl.col("threadId") == threadId)

            # --- Sender filter (case-insensitive, matches name or email) ---
            if sender:
                sender = sender.lower()
                # Add a normalized column
                temp_df = temp_df.with_columns([
                    pl.col("from").map_elements(normalize_list, return_dtype=str).alias("from_normalized")
                ])
                # Filter rows where the normalized 'from' matches sender
                sender_mask = pl.col("from_normalized").map_elements(lambda x: match_value_in_columns(sender, x), return_dtype=bool)
                mask = mask & sender_mask

            # --- Recipient filter ---
            if recipient:
                recipient = recipient.lower()
                # Normalize 'to' and 'cc' columns which are lists
                temp_df = temp_df.with_columns([
                    pl.col("to").map_elements(normalize_list, return_dtype=str).alias("to_normalized")
                ])
                # Filter rows where any normalized 'to' or 'cc' matches the recipient
                recipient_mask = (
                    pl.col("to_normalized").map_elements(lambda x: match_value_in_columns(recipient, x), return_dtype=bool)
                )
                if cc:
                    # Normalize 'to' and 'cc' columns which are lists
                    temp_df = temp_df.with_columns([
                        pl.col("cc").map_elements(normalize_list, return_dtype=str).alias("cc_normalized")
                    ])
                    # Filter rows where any normalized 'to' or 'cc' matches the recipient
                    cc_mask = (
                        pl.col("cc_normalized").map_elements(lambda x: match_value_in_columns(recipient, x), return_dtype=bool)
                    )
                    recipient_mask = recipient_mask | cc_mask

                mask = mask & recipient_mask

            # --- Date filtering (normalize to datetime) ---
            dt1 = pl.col("date").str.to_datetime("%Y-%m-%dT%H:%M:%S", strict=False).dt.replace_time_zone("UTC")
            dt2 = pl.col("date").str.to_datetime("%Y-%m-%dT%H:%M:%S%z", strict=False).dt.convert_time_zone("UTC")
            temp_df = temp_df.with_columns(
                pl.coalesce([dt1, dt2]).alias("date_dt")
            )

            range_start, range_end = build_date_range(start_date, end_date)
            if range_start and range_end:
                mask = mask & (pl.col("date_dt") >= range_start) & (pl.col("date_dt") <= range_end)

            if labels: 
                labels = [lbl.strip().lower() for lbl in labels]

                temp_df = temp_df.with_columns([
                    pl.col("labels").map_elements(normalize_list, return_dtype=str).alias("labels_normalized")
                ])

                labels_mask = pl.col("labels_normalized").map_elements(
                    lambda email_lables: any(lbl in email_lables for lbl in labels),
                    return_dtype=bool
                )

                mask = mask & labels_mask

            if subject:    
                subject_mask = pl.col("subject").map_elements(lambda x: smart_subject_match(subject, x), return_dtype=bool)
                mask = mask & subject_mask

            # Apply the mask only once
            temp_df = temp_df.filter(mask)

            # --- Sorting ---
            temp_df = temp_df.sort(
                by=sort_by,
                descending=(sort_order.lower() == "desc")
            )

            # --- Handle empty result ---
            if temp_df.is_empty():
                return "No emails found matching the specified criteria."
            
            if thread_details:
                unique_threads_count = temp_df.select(pl.col("threadId")).unique().height
                unique_threads_df = temp_df.sort("date_dt", descending=True).select(pl.col("threadId")).unique()
                unique_threads = unique_threads_df["threadId"].to_list()

                summaries: List[Tuple[str, str]] = []
                if thread_details_limit is None:
                    for tid in unique_threads:
                        thread_df = temp_df.filter(pl.col("threadId") == tid).sort("date_dt", descending=False)
                        emails = thread_df.select(["from", "to", "subject", "snippet", "body_text", "date_dt"]).to_dicts()
                        for email in emails:
                            summaries.append((tid, json.dumps(email, default=str)))
                else:
                    for tid in unique_threads[:thread_details_limit]:
                        thread_df = temp_df.filter(pl.col("threadId") == tid).sort("date_dt", descending=False)
                        emails = thread_df.select(["from", "to", "subject", "snippet", "body_text", "date_dt"]).to_dicts()
                        for email in emails:
                            summaries.append((tid, json.dumps(email, default=str)))

                final_summary = EmailFilteringTool.hierarchical_summary(summaries)
                return f"Total {unique_threads_count} threads matching the criteria.\n\nSummary of {min(thread_details_limit, len(summaries)) if thread_details_limit else len(summaries)} threads:\n{final_summary}"

            if thread_count:
                unique_threads_count = temp_df.select(pl.col("threadId")).unique().height
                return f"Total unique email threads: {unique_threads_count}"

            # --- Preview results ---
            total_matches = temp_df.height
            preview_cols = ["id", "threadId", "from", "to", "subject", "date_dt", "cc", "snippet", "labels", "attachments"]
            if body:
                preview_cols.append("body_text")
            if html:
                preview_cols.append("body_html")

            if limit is None:
                results_preview = temp_df.select(preview_cols).to_dicts()
            else:
                results_preview = temp_df.head(limit).select(preview_cols).to_dicts()

            def fmt(res):
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
            shown = total_matches if limit is None else min(int(limit), total_matches)

            return f"Found {total_matches} emails matching the criteria. Showing {shown}:\n\n{formatted_results}"
        
        except Exception as e:
            err_payload = {"error": str(e), "traceback": traceback.format_exc()}
            print(f"\033[91m{err_payload}\033[0m")
            return "\n\n---".join(json.dumps(err_payload))