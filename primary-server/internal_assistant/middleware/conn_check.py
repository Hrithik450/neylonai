from django.db import connections
from django.db.utils import OperationalError

class AutoReconnectDBMiddleware:
    """
    Middleware to automatically reconnect or refresh stale DB connections safely.
    Prevents 'connection already closed' errors, even during raw SQL operations.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        print("\n[Middleware] --- New Request ---")

        for conn in connections.all():
            print(f"[Middleware] Checking connection '{conn.alias}' before view...")

            # Skip if we're inside a transaction (atomic block)
            if conn.in_atomic_block:
                print(f"[Middleware] '{conn.alias}' is in atomic block, skipping reconnect.")
                continue

            try:
                conn.ensure_connection()  # Ensure it’s open and healthy
                print(f"[Middleware] Connection '{conn.alias}' is healthy.")
            except OperationalError:
                print(f"[Middleware] Connection '{conn.alias}' broken — reconnecting...")
                conn.close()
                conn.connect()

        response = self.get_response(request)

        # After response — cleanup stale or dead connections (not during atomic)
        for conn in connections.all():
            if not conn.in_atomic_block:
                conn.close_if_unusable_or_obsolete()
                print(f"[Middleware] --- Request Completed: all non-atomic connections checked and closed.---\n")

        return response