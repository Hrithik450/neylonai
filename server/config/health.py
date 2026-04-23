from django.db import connection
from django.core.cache import cache
from django.http import JsonResponse
from django.core.files.base import ContentFile


def health_check(request):
    checks = {}
    status_code = 200

    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = str(e)
        status_code = 500

    # 2. Cache (Redis/Memcached)
    try:
        cache.set("health_check", "ok", timeout=5)
        assert cache.get("health_check") == "ok"
        checks["cache"] = "ok"
    except Exception as e:
        checks["cache"] = str(e)
        status_code = 500

    # 3. Storage / Media files writable
    try:
        from django.core.files.storage import default_storage

        default_storage.save("health_check.txt", ContentFile(b"ok"))
        default_storage.delete("health_check.txt")
        checks["storage"] = "ok"
    except Exception as e:
        checks["storage"] = str(e)
        status_code = 500

    return JsonResponse(
        {"status": "ok" if status_code == 200 else "error", "checks": checks},
        status=status_code,
    )
