import json
import traceback
import polars as pl
from ..lib.load_data import df
from ..lib.utils import normalize_list, match_value_in_columns, smart_subject_match, build_date_range, human_readable_date

class EmailFilteringTool:
    temp_df = df.clone()

    @classmethod
    def run_tool(
        cls, 
        uid: str = None,
        threadId: str = None,
        sender: str = None,
        recipient: str = None,
        subject: str = None,
        cc: bool = False,
        labels: list[str] = None,
        start_date: str = None,
        end_date: str = None,
        body: bool = False,
        html: bool = False,
        sort_by: str = "date",
        sort_order: str = "desc",
        limit: int = None,):
        try:
            print(f"email_filtering_tool is being called {uid}, {threadId}, {sender}, {recipient}, {subject}, {cc}, {labels}, {start_date}, {end_date}, {body}, {html}, {sort_by}, {sort_order}, {limit}")
            mask = pl.lit(True)

            cls.temp_df = cls.temp_df.with_columns([
                cls.temp_df["body"].struct.field("text").alias("body_text"),
                cls.temp_df["body"].struct.field("html").alias("body_html"),
            ])

            if uid:
                mask = mask & (pl.col("id") == uid)

            if threadId:
                mask = mask & (pl.col("threadId") == threadId)

            # --- Sender filter (case-insensitive, matches name or email) ---
            if sender:
                sender = sender.lower()
                # Add a normalized column
                cls.temp_df = cls.temp_df.with_columns([
                    pl.col("from").map_elements(normalize_list, return_dtype=str).alias("from_normalized")
                ])
                # Filter rows where the normalized 'from' matches sender
                sender_mask = pl.col("from_normalized").map_elements(lambda x: match_value_in_columns(sender, x), return_dtype=bool)
                mask = mask & sender_mask

            # --- Recipient filter ---
            if recipient:
                recipient = recipient.lower()
                # Normalize 'to' and 'cc' columns which are lists
                cls.temp_df = cls.temp_df.with_columns([
                    pl.col("to").map_elements(normalize_list, return_dtype=str).alias("to_normalized")
                ])
                # Filter rows where any normalized 'to' or 'cc' matches the recipient
                recipient_mask = (
                    pl.col("to_normalized").map_elements(lambda x: match_value_in_columns(recipient, x), return_dtype=bool)
                )
                if cc:
                    # Normalize 'to' and 'cc' columns which are lists
                    cls.temp_df = cls.temp_df.with_columns([
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
            cls.temp_df = cls.temp_df.with_columns(
                pl.coalesce([dt1, dt2]).alias("date_dt")
            )

            range_start, range_end = build_date_range(start_date, end_date)
            if range_start and range_end:
                mask = mask & (pl.col("date_dt") >= range_start) & (pl.col("date_dt") <= range_end)

            if labels: 
                labels = [lbl.strip().lower() for lbl in labels]

                cls.temp_df = cls.temp_df.with_columns([
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
            cls.temp_df = cls.temp_df.filter(mask)

            # --- Sorting ---
            cls.temp_df = cls.temp_df.sort(
                by=sort_by,
                descending=(sort_order.lower() == "desc")
            )

            # --- Handle empty result ---
            if cls.temp_df.is_empty():
                return "No emails found matching the specified criteria."

            # --- Preview results ---
            total_matches = cls.temp_df.height
            preview_cols = ["id", "threadId", "from", "to", "subject", "date_dt", "cc", "snippet", "labels", "attachments"]
            if body:
                preview_cols.append("body_text")
            if html:
                preview_cols.append("body_html")

            if limit is None:
                results_preview = cls.temp_df.select(preview_cols).to_dicts()
            else:
                results_preview = cls.temp_df.head(limit).select(preview_cols).to_dicts()

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