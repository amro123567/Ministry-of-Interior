"""Database configuration for the Correspondence Tracking System.

MySQL is the database. The application used to fall back to a local SQLite
file whenever DATABASE_URL was unset, which meant a misconfigured
environment did not fail -- it quietly ran against a different database with
different data, and nothing on screen said so. That fallback is gone: if
MySQL is not configured or not reachable, the application says so and stops.

Settings come from the environment, or from a `.env` file beside this one so
they are not typed on every run and not committed to the repository. See
.env.example for the template.

    MYSQL_HOST       default 127.0.0.1
    MYSQL_PORT       default 3306
    MYSQL_DATABASE   default civil_registry_db
    MYSQL_USER       default cts_app
    MYSQL_PASSWORD   required
    DATABASE_URL     optional -- a full SQLAlchemy URL, overrides the above

utf8mb4 is pinned on the connection as well as on the schema. SDD D-14:
"Arabic requires utf8mb4. A server defaulting to latin1 corrupts every
Arabic name silently and irreversibly" -- and a client connecting in latin1
corrupts it just as thoroughly as a server storing it that way.
"""
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
ENV_FILE = PROJECT_ROOT / ".env"


def _load_env_file():
    """Read .env into the environment without overwriting real variables.

    Deliberately hand-rolled rather than adding python-dotenv: it is fifteen
    lines, and one fewer dependency to install on a machine that is about to
    have enough trouble installing MySQL.
    """
    if not ENV_FILE.exists():
        return
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_env_file()


class ConfigurationError(RuntimeError):
    """Raised with an instruction, not a stack trace."""


def _fail(problem, fix):
    raise ConfigurationError(
        f"\n\n  Database not configured: {problem}\n\n  {fix}\n"
        f"  Settings are read from {ENV_FILE} or from the environment.\n"
        f"  See .env.example for the template, and README.md for the setup steps.\n"
    )


def database_url():
    """The SQLAlchemy URL for the one database this application uses."""
    explicit = os.environ.get("DATABASE_URL", "").strip()
    if explicit:
        if explicit.startswith("sqlite"):
            _fail(
                "DATABASE_URL points at SQLite.",
                "This application runs on MySQL. Remove DATABASE_URL to use the\n"
                "  MYSQL_* settings, or point it at a MySQL server.",
            )
        return explicit

    password = os.environ.get("MYSQL_PASSWORD")
    if password is None:
        _fail(
            "MYSQL_PASSWORD is not set.",
            "Copy .env.example to .env and put your MySQL password in it.",
        )

    host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    port = os.environ.get("MYSQL_PORT", "3306")
    database = os.environ.get("MYSQL_DATABASE", "civil_registry_db")
    user = os.environ.get("MYSQL_USER", "cts_app")

    from urllib.parse import quote_plus
    return (f"mysql+pymysql://{quote_plus(user)}:{quote_plus(password)}"
            f"@{host}:{port}/{database}?charset=utf8mb4")


def engine_options():
    """Connection settings that matter for a long-running registry.

    pool_pre_ping: MySQL closes idle connections after wait_timeout (8 hours
    by default, often much less on a laptop that sleeps). Without a pre-ping
    the first request after an idle spell fails with "MySQL server has gone
    away" -- once -- and then works, which is the most confusing possible
    failure mode for whoever is using the system.
    """
    return {
        "pool_pre_ping": True,
        "pool_recycle": 3600,
        "connect_args": {"charset": "utf8mb4"},
    }


def describe():
    """A one-line description of the target, with the password removed."""
    url = database_url()
    if "@" in url:
        head, _, tail = url.partition("@")
        scheme = head.split("//")[0]
        user = head.split("//")[1].split(":")[0]
        return f"{scheme}//{user}:***@{tail}"
    return url
