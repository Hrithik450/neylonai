from .services.encoder_service import EncoderService, EncoderRequest, EncoderResponse
from rest_framework.response import Response
from rest_framework.views import APIView
from pydantic import ValidationError
from rest_framework import status
from .lib.utils import batchify
from .lib.utils import report
import concurrent.futures
import numpy as np
import threading
import datetime
import json

class EncoderAPIView(APIView):
    _, tokenizer = EncoderService.load_model()
    thread_pool_excecutor = concurrent.futures.ThreadPoolExecutor(max_workers=8)

    @staticmethod
    def process_batch(i, q_batch, t_batch):
        thread_name = threading.current_thread().name
        print(f"{datetime.datetime.now()} - Start batch {i} on {thread_name}")

        batch_data = {"queries": q_batch, "texts": t_batch}
        response:EncoderResponse = EncoderService.encode(batch_data)
        if not getattr(response, "success"):
            raise RuntimeError(f"Encoding failed for batch {i}")
        
        print(f"{datetime.datetime.now()} - End batch {i} on {thread_name}")
        return i, np.array(getattr(response, "data"), dtype=np.float32).tolist()

    @classmethod
    def post(cls, request):
        try:
            data = request.data
            report("After getting request data")

            # Validate input
            validated = EncoderRequest(**data)
            queries, texts = validated.queries, validated.texts
            report("After validation")

            # Batch processing
            batches = batchify(queries, texts, cls.tokenizer, max_tokens=1000)
            report(f"After batching ({len(batches)} batches)")

            # Run batches in parrellel using 8 threads
            results = []
            for future in concurrent.futures.as_completed({cls.thread_pool_excecutor.submit(cls.process_batch, i, q_batch, t_batch): i for i, (q_batch, t_batch) in enumerate(batches, start=0)}):
                _, result = future.result()
                results.extend(result)
            return Response({"success": True, "data": json.dumps(results), "error": None}, status=status.HTTP_200_OK)
        
        except ValidationError as ve:
            report("Validation error occurred")
            return Response({"success": False, "Validation error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            report("Exception occurred")
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)