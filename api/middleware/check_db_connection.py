import time
from django.db import connections
from django.db.utils import OperationalError


class AutoReconnectDBMiddleware:
    """
    Middleware to automatically reconnect or refresh stale DB connections safely.
    Prevents 'connection already closed' errors, even during raw SQL operations.
    """

    MAX_AGE = 300

    def __init__(self, get_response):
        self.get_response = get_response
        self.last_checked = time.time()

    def __call__(self, request):
        print("\n[Middleware] --- New Request ---")
        now = time.time()
        elapsed = now - self.last_checked

        for conn in connections.all():
            print(f"[Middleware] Checking connection '{conn.alias}' before view...")

            # Skip if we're inside a transaction (atomic block)
            if conn.in_atomic_block:
                print(
                    f"[Middleware] '{conn.alias}' is in atomic block, skipping reconnect."
                )
                continue

            if elapsed > self.MAX_AGE:
                print(
                    f"[Middleware] > {self.MAX_AGE}s passed — refreshing connection '{conn.alias}'."
                )
                try:
                    conn.close_if_unusable_or_obsolete()
                    conn.ensure_connection()
                    print(f"[Middleware] '{conn.alias}' reconnected successfully.")
                except OperationalError as e:
                    print(
                        f"[Middleware] Failed to reconnect '{conn.alias}': {str(e)}. Retrying..."
                    )
                    conn.close()
                    conn.connect()
                self.last_checked = now
            else:
                try:
                    if not conn.is_usable():
                        print(f"[Middleware] '{conn.alias}' is stale — reconnecting...")
                        conn.close()
                        conn.connect()
                    else:
                        print(f"[Middleware] Connection '{conn.alias}' is healthy.")
                except OperationalError as e:
                    print(
                        f"[Middleware] Error checking '{conn.alias}': {str(e)}. Reconnecting..."
                    )
                    conn.close()
                    conn.connect()

        response = self.get_response(request)

        # After response — cleanup stale or dead connections (not during atomic)
        for conn in connections.all():
            if not conn.in_atomic_block:
                conn.close_if_unusable_or_obsolete()
                print(
                    f"[Middleware] --- Request Completed: all non-atomic connections checked and closed.---\n"
                )

        return response
