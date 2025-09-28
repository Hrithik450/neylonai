from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .lib.utils import report

report("before importing enocder service")
from .lib.encoder_service import EncoderService, EncoderRequest
from .lib.utils import batchify
report("after importing everything")

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

            all_results = []

            # Batch processing
            _, tokenizer = EncoderService.load_model()
            batches = batchify(queries, texts, tokenizer, max_tokens=4000)
            report(f"After batching ({len(batches)} batches)")

            for i, (q_batch, t_batch) in enumerate(batches, start=1):
                batch_data = {"queries": q_batch, "texts": t_batch}
                report(f"Before encoding batch {i}")

                result = EncoderService.encode(batch_data)
                if not result.get("success"):
                    return Response(result, status=status.HTTP_400_BAD_REQUEST)
                all_results.extend(result["data"]["list"])
                report(f"After encoding batch {i}")

            report("After all batches")
            return Response({"success": True, "data": {"list": all_results}})

        except Exception as e:
            report("Exception occurred")
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)