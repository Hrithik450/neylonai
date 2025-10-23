import time 
from django.db import connections

class AutoReconnectDBMiddleware:
    """
    Middleware to automatically close and refresh stale DB connections.
    Works well with Cloud Run to prevent 'connection already closed' errors.
    """

    MAX_AGE = 300
    def __init__(self, get_response):
        self.get_response = get_response
        self.last_checked = time.time()

    def __call__(self, request):
        now = time.time()
        elapsed = now - self.last_checked

        # If more than MAX_AGE seconds passed, refresh all DB connections
        if now-self.last_checked > self.MAX_AGE:
            print(f"[AutoReconnectDBMiddleware] > {self.MAX_AGE}s passed — refreshing all DB connections.")
            for conn in connections.all():
                conn.close_if_unusable_or_obsolete()
                print(f"[AutoReconnectDBMiddleware] Refreshing connection '{conn.alias}'")
            self.last_checked = now
        else:
            print(f"[AutoReconnectDBMiddleware] Not refreshing — within {self.MAX_AGE}s window.")
        
        # Always ensure connections are valid before handling a request
        for conn in connections.all():
            print(f"[AutoReconnectDBMiddleware] Checking connection '{conn.alias}' before view...")
            conn.close_if_unusable_or_obsolete()

        response = self.get_response(request)

        # And after sending response, close stale connections if needed
        for conn in connections.all():
            print(f"[AutoReconnectDBMiddleware] Checking connection '{conn.alias}' after response...")
            conn.close_if_unusable_or_obsolete()

        print("[AutoReconnectDBMiddleware] --- Request Completed ---\n")
        return response