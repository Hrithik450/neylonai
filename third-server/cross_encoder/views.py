from .lib.encoder_service import EncoderService, EncoderRequest
from django.http import StreamingHttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from .lib.utils import batchify
from .lib.utils import report
import numpy as np
import json
import gc

class EncoderAPIView(APIView):
    def post(self, request):
        try:
            report("Start POST request")

            data = request.data
            report("After getting request data")
            # Validate input
            validated = EncoderRequest(**data)
            queries, texts = validated.queries, validated.texts
            report("After validation")

            def batch_generator():
                # Batch processing
                _, tokenizer = EncoderService.load_model()
                batches = batchify(queries, texts, tokenizer, max_tokens=20000)
                report(f"After batching ({len(batches)} batches)")

                for i, (q_batch, t_batch) in enumerate(batches, start=1):
                    batch_data = {"queries": q_batch, "texts": t_batch}
                    report(f"Before encoding batch {i}")

                    for result in EncoderService.encode(batch_data):
                        if not result.get("success"):
                            yield json.dumps({"success": False, "error": "Encoding failed"}) + "\n"
                            return
                
                        batch_np = np.array(result["data"]["list"], dtype=np.float32)
                        yield json.dumps({"success": True, "batch": batch_np.tolist()}) + "\n"

                        del batch_np
                        del result
                        gc.collect()
                        report(f"After encoding batch {i}")
            return StreamingHttpResponse(batch_generator(), content_type="application/json")
        except Exception as e:
            report("Exception occurred")
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)