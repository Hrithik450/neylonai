# 1. Check settings & models

python manage.py check

# 2. Check migrations

python manage.py makemigrations --dry-run
python manage.py migrate --plan

# 3. Run tests (if any)

python manage.py test app --keepdb

# 4. Start server to verify

python manage.py runserver

# Delete these files if pushed to git by mistake

# 5. Delete the existing active connections if error occured during testing

psql postgres://username:password@host:port/dbname

SELECT pid, datname, usename, application_name, state
FROM pg_stat_activity
WHERE datname = 'test_test_postgres_safe';

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'test_test_postgres_safe';

DROP DATABASE test_test_postgres_safe;

<!--
git rm -r --cached server/venv
git rm -r --cached *.pyc
 -->
