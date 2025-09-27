from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.request import Request

@api_view(["GET"])
def health_check(request: Request):
    return Response({"status": "ok"})