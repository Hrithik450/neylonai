from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import DatabaseError
from django.db import connection
from django.http import JsonResponse
from rest_framework import status


def health_check(request):
    checks = {}
    status_code = status.HTTP_200_OK

    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["db"] = "ok"
    except DatabaseError as exc:
        checks["db"] = str(exc)
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    # 2. Cache (Redis/Memcached)
    try:
        cache.set("health_check", "ok", timeout=5)
        assert cache.get("health_check") == "ok"
        checks["cache"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["cache"] = str(exc)
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    # 3. Storage / Media files writable
    try:
        default_storage.save("health_check.txt", ContentFile(b"ok"))
        default_storage.delete("health_check.txt")
        checks["storage"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["storage"] = str(exc)
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    return JsonResponse(
        {
            "status": "ok" if status_code == status.HTTP_200_OK else "error",
            "checks": checks,
        },
        status=status_code,
    )
