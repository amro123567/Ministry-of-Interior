<#
  cleanup-flask-stack.ps1

  Removes the Flask/Python prototype from this repository, now that the
  Spring Boot + React rewrite (backend/, frontend/) is the active system.

  What this DOES:
    - Removes Flask source files and folders from git tracking and disk.
    - Deletes untracked Python cruft (venv/, __pycache__/, .pytest_cache/,
      the root .env used by the Flask app).
    - Deletes two one-off setup scripts (install-maven.ps1,
      create_spring_db.py) that already did their job.

  What this does NOT do:
    - It does NOT touch the MySQL database. The Flask system's data
      (civil_registry_db) is left completely alone -- this script only
      removes files, never drops or alters any database.
    - It does NOT delete docs/ (the ERD source lives there, not Flask code)
      or backend/ or frontend/ (the new system).
    - It does NOT commit anything. Review `git status` yourself and commit
      when you're satisfied.

  The Flask code is not gone forever even after this runs: it's preserved
  at the git tag v1.0-flask-mysql, so `git checkout v1.0-flask-mysql` can
  always bring it back if you ever need to reference it again.

  Run this from the repository root in the VS Code terminal:
      .\cleanup-flask-stack.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "== Removing tracked Flask files from git ==" -ForegroundColor Cyan
$trackedPaths = @(
    "admin_views.py",
    "app.py",
    "config.py",
    "extensions.py",
    "i18n.py",
    "migrations",
    "models.py",
    "requirements.txt",
    "schema",
    "seed.py",
    "static",
    "templates",
    "tests",
    "USER_MANUAL.md",
    ".env.example"
)
foreach ($p in $trackedPaths) {
    if (Test-Path $p) {
        git rm -r -f --ignore-unmatch -- "$p" | Out-Null
        Write-Host "  removed (git): $p"
    } else {
        Write-Host "  skip (not present): $p" -ForegroundColor DarkGray
    }
}

Write-Host "`n== Deleting untracked Python/setup cruft ==" -ForegroundColor Cyan
$untrackedPaths = @(
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".env",
    "install-maven.ps1",
    "create_spring_db.py"
)
foreach ($p in $untrackedPaths) {
    if (Test-Path $p) {
        Remove-Item -Recurse -Force -- $p
        Write-Host "  deleted: $p"
    } else {
        Write-Host "  skip (not present): $p" -ForegroundColor DarkGray
    }
}

Write-Host "`n== Done ==" -ForegroundColor Green
Write-Host "The Flask/Python stack has been removed from the working tree."
Write-Host "The MySQL databases (civil_registry_db and cts_spring_db) were NOT touched."
Write-Host "The old code is still recoverable any time via: git checkout v1.0-flask-mysql"
Write-Host ""
Write-Host "Next: review the changes, then commit them yourself:" -ForegroundColor Yellow
Write-Host "  git status"
Write-Host "  git add -A"
Write-Host "  git commit -m `"Remove Flask/Python prototype, keep Spring Boot + React rewrite`""
