# 1. Check settings & models

python manage.py check

# 2. Check migrations

python manage.py makemigrations --dry-run
python manage.py migrate --plan

# 3. Run tests (if any)

python manage.py test

# 4. Start server to verify

python manage.py runserver
