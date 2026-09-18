"""Create the MySQL database, apply the schema, and move the data across.

One command, run once:

    python schema/setup_mysql.py --admin-user root --admin-password YOURPASS

It will:
  1. create the database `civil_registry_db` with utf8mb4
  2. create the application user and grant it rights on that database only
  3. apply schema/mysql_schema.sql -- 46 tables, indexes, constraints, triggers
  4. copy the rows from moi_registry.db, if that file is still present
  5. verify the result and print what to do next

Everything is done through PyMySQL rather than by shelling out to the `mysql`
client, because on Windows that client is usually not on PATH and chasing
that is a worse first experience than installing the server was.

Safe to re-run. Nothing is dropped unless you pass --recreate.
"""
import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pymysql  # noqa: E402

SCHEMA_SQL = ROOT / "schema" / "mysql_schema.sql"
SQLITE_DB = ROOT / "moi_registry.db"


# ---------------------------------------------------------------------------
# Splitting the script
# ---------------------------------------------------------------------------

def split_statements(sql_text):
    """Split a .sql script into statements, honouring DELIMITER.

    DELIMITER is a directive of the mysql command-line client, not SQL, so a
    driver never sees it. The trigger definitions need it because their
    bodies contain semicolons, so the splitting has to be done here.
    """
    statements, buf, delim = [], [], ";"
    for line in sql_text.splitlines():
        stripped = line.strip()
        if stripped.upper().startswith("DELIMITER "):
            if buf:
                statements.append("\n".join(buf))
                buf = []
            delim = stripped.split(None, 1)[1].strip()
            continue
        buf.append(line)
        if stripped.endswith(delim):
            joined = "\n".join(buf)
            joined = joined.rstrip()[: -len(delim)].strip()
            if joined:
                statements.append(joined)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        statements.append(tail)
    return [s for s in statements
            if s.strip() and not all(l.strip().startswith("--") or not l.strip()
                                     for l in s.splitlines())]


def connect(args, database=None):
    return pymysql.connect(
        host=args.host, port=args.port,
        user=args.admin_user, password=args.admin_password,
        database=database, charset="utf8mb4", autocommit=True,
    )


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

def step(n, text):
    print(f"\n[{n}] {text}")


def create_database_and_user(args):
    step(1, f"Creating database `{args.database}` and user `{args.app_user}`")
    with connect(args) as conn, conn.cursor() as cur:
        cur.execute("SELECT VERSION()")
        version = cur.fetchone()[0]
        print(f"    server: {version}")
        if args.recreate:
            print(f"    dropping existing `{args.database}` (--recreate)")
            cur.execute(f"DROP DATABASE IF EXISTS `{args.database}`")
        cur.execute(
            f"CREATE DATABASE IF NOT EXISTS `{args.database}` "
            f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        # The application does not connect as root. SDD §6.8.3 asks for access
        # control at the data layer; an account with rights on one schema is
        # the least this can mean.
        for host in ("localhost", "127.0.0.1", "%"):
            cur.execute("CREATE USER IF NOT EXISTS %s@%s IDENTIFIED BY %s",
                        (args.app_user, host, args.app_password))
            cur.execute("ALTER USER %s@%s IDENTIFIED BY %s",
                        (args.app_user, host, args.app_password))
            cur.execute(
                f"GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, "
                f"REFERENCES, TRIGGER ON `{args.database}`.* TO %s@%s",
                (args.app_user, host))
        cur.execute("FLUSH PRIVILEGES")
        print(f"    granted on `{args.database}`.* only")
        return version


def apply_schema(args, version):
    step(2, f"Applying {SCHEMA_SQL.name}")
    if not SCHEMA_SQL.exists():
        sys.exit(f"    missing {SCHEMA_SQL}. Run: python schema/generate_mysql_ddl.py "
                 f"> schema/mysql_schema.sql")
    sql = SCHEMA_SQL.read_text(encoding="utf-8")
    statements = split_statements(sql)
    applied = skipped = 0
    warnings = []
    with connect(args, args.database) as conn, conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS=0")
        for stmt in statements:
            if re.match(r"^\s*(CREATE DATABASE|USE)\b", stmt, re.I):
                continue
            try:
                cur.execute(stmt)
                applied += 1
            except pymysql.err.MySQLError as exc:
                code = exc.args[0]
                if code in (1050, 1061, 1826, 1359):      # already exists
                    skipped += 1
                elif "ngram" in stmt:
                    # MySQL 8 has the ngram parser; MariaDB does not. R-13
                    # wants it for partial Arabic name matching, so its
                    # absence is reported rather than passed over.
                    warnings.append(
                        "FULLTEXT ... WITH PARSER ngram was refused by this server "
                        "(MySQL 8 supports it; MariaDB does not). Partial Arabic "
                        "name search will fall back to prefix matching.")
                else:
                    sys.exit(f"\n    FAILED on statement:\n{stmt[:400]}\n    {exc}")
        cur.execute("SET FOREIGN_KEY_CHECKS=1")
    print(f"    {applied} statements applied, {skipped} already present")
    for w in warnings:
        print(f"    note: {w}")


def load_data(args):
    step(3, "Copying rows from moi_registry.db")
    if not SQLITE_DB.exists():
        print("    no moi_registry.db found -- skipping. Run `python seed.py` "
              "afterwards to populate the database.")
        return 0
    os.environ["DATABASE_URL"] = (
        f"mysql+pymysql://{args.app_user}:{args.app_password}"
        f"@{args.host}:{args.port}/{args.database}?charset=utf8mb4")
    os.environ.setdefault("SECRET_KEY", "setup-script")

    from sqlalchemy import create_engine, text
    from app import app      # noqa: F401  -- importing binds the metadata
    from extensions import db
    import models            # noqa: F401  -- registers every table

    src = create_engine(f"sqlite:///{SQLITE_DB}")
    dst = create_engine(os.environ["DATABASE_URL"])
    total = 0
    with src.connect() as s, dst.begin() as d:
        d.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        existing = d.execute(text("SELECT COUNT(*) FROM citizens")).scalar()
        if existing and not args.recreate:
            print(f"    citizens already holds {existing} rows -- skipping the copy. "
                  f"Use --recreate to start clean.")
            d.execute(text("SET FOREIGN_KEY_CHECKS=1"))
            return 0
        for table in db.metadata.sorted_tables:
            rows = [dict(r._mapping) for r in s.execute(table.select())]
            if rows:
                d.execute(table.insert(), rows)
                total += len(rows)
        d.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    print(f"    {total} rows copied across {len(db.metadata.sorted_tables)} tables")
    return total


def verify(args):
    step(4, "Verifying")
    with connect(args, args.database) as conn, conn.cursor() as cur:
        def one(q):
            cur.execute(q)
            return cur.fetchone()[0]
        tables = one("SELECT COUNT(*) FROM information_schema.tables "
                     "WHERE table_schema=DATABASE()")
        fks = one("SELECT COUNT(*) FROM information_schema.referential_constraints "
                  "WHERE constraint_schema=DATABASE()")
        trgs = one("SELECT COUNT(*) FROM information_schema.triggers "
                   "WHERE trigger_schema=DATABASE()")
        idxs = one("SELECT COUNT(DISTINCT table_name, index_name) "
                   "FROM information_schema.statistics WHERE table_schema=DATABASE()")
        cur.execute("SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema=DATABASE() AND (engine<>'InnoDB' "
                    "OR table_collation NOT LIKE 'utf8mb4%')")
        wrong = cur.fetchone()[0]
        citizens = one("SELECT COUNT(*) FROM citizens")
        cur.execute("SELECT last_name_ar FROM citizens WHERE last_name_ar IS NOT NULL LIMIT 1")
        sample = cur.fetchone()
        print(f"    tables {tables} | foreign keys {fks} | indexes {idxs} | triggers {trgs}")
        print(f"    non-InnoDB or non-utf8mb4 tables: {wrong}")
        print(f"    citizens: {citizens}")
        if sample:
            print(f"    Arabic round-trip: {sample[0]}")
        problems = []
        if tables < 46:
            problems.append(f"expected 46 tables, found {tables}")
        if wrong:
            problems.append(f"{wrong} tables are not InnoDB/utf8mb4")
        if sample and sample[0].startswith("?"):
            problems.append("Arabic text came back corrupted -- check the connection charset")
        return problems


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", default=os.environ.get("MYSQL_HOST", "127.0.0.1"))
    p.add_argument("--port", type=int, default=int(os.environ.get("MYSQL_PORT", 3306)))
    p.add_argument("--admin-user", default="root",
                   help="an account that may create databases and users")
    p.add_argument("--admin-password", default=os.environ.get("MYSQL_ADMIN_PASSWORD"),
                   help="password for --admin-user")
    p.add_argument("--database", default=os.environ.get("MYSQL_DATABASE", "civil_registry_db"))
    p.add_argument("--app-user", default=os.environ.get("MYSQL_USER", "cts_app"))
    p.add_argument("--app-password", default=os.environ.get("MYSQL_PASSWORD"),
                   help="password to set for the application user")
    p.add_argument("--recreate", action="store_true",
                   help="drop the database first and rebuild it from nothing")
    args = p.parse_args()

    if args.admin_password is None:
        import getpass
        args.admin_password = getpass.getpass(f"MySQL password for {args.admin_user}: ")
    if args.app_password is None:
        import getpass
        args.app_password = getpass.getpass(f"password to set for {args.app_user}: ")

    print(f"Target: {args.host}:{args.port}/{args.database}")
    version = create_database_and_user(args)
    apply_schema(args, version)
    load_data(args)
    problems = verify(args)

    if problems:
        print("\nPROBLEMS:")
        for x in problems:
            print(f"  - {x}")
        sys.exit(1)

    print(f"""
Done. Put these in your .env file (copy .env.example if you have not yet):

    MYSQL_HOST={args.host}
    MYSQL_PORT={args.port}
    MYSQL_DATABASE={args.database}
    MYSQL_USER={args.app_user}
    MYSQL_PASSWORD={args.app_password}

Then:

    python -m flask db stamp head      (record the schema version)
    python app.py                      (open http://localhost:5000/admin/)
""")


if __name__ == "__main__":
    main()
