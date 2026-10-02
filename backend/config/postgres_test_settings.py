from .settings import *
name = os.getenv("POSTGRES_TEST_DB", "test_restaurant_backend")
if not name.startswith("test_"):
    raise ImproperlyConfigured("POSTGRES_TEST_DB must start with test_.")
DATABASES["default"]["TEST"] = {"NAME": name}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
