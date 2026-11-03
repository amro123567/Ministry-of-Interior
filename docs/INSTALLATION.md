# CTS — Installation Guide

Correspondence Tracking System, Ministry of Interior, Directorate of Civil Status.
This guide installs the whole system (database, API, web interface) on one machine.

## 1. What you need

| Item | Version | Check |
|---|---|---|
| Docker Desktop (with Compose v2) | 4.x or later | `docker --version` and `docker compose version` |
| Git | any recent | `git --version` |
| Free ports | 3443 (web), 8080 (API), 3307 (database, host side) | — |
| Disk and memory | about 3 GB disk, 4 GB RAM available to Docker | — |

For running without Docker, see section 6.

## 2. Get the code

```powershell
git clone https://github.com/amro123567/Ministry-of-Interior.git
cd Ministry-of-Interior
```

## 3. Configure secrets

Compose reads a file named `.env` in the project root. It is not committed to git.

```powershell
copy .env.example .env
```

Open `.env` and replace the three placeholders:

| Variable | Meaning |
|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL administrator password |
| `MYSQL_PASSWORD` | password of the application's database user |
| `JWT_SECRET` | long random string used to sign login tokens |

To generate a `JWT_SECRET` in PowerShell:

```powershell
[Convert]::ToBase64String((1..48|%{Get-Random -Max 256}))
```

`MYSQL_DATABASE` and `MYSQL_USER` can stay as they are.

## 4. Start the system

```powershell
docker compose up --build -d
```

The first start builds the images and creates the database schema; allow two to three minutes. Check the status:

```powershell
docker compose ps
```

`mysql` and `backend` must show **healthy**, and `frontend` must show **running**.

## 5. Open and verify

1. Open **https://localhost:3443** in a browser.
2. The certificate is self-signed, so the browser shows a warning the first time. Choose *Advanced*, then *Proceed*. A real deployment would install a certificate from the Ministry's internal authority.
3. Sign in with a demo account:

| Username | Password | Role |
|---|---|---|
| admin | Admin1234! | Administrator |
| manager | Manager1234! | Manager |
| officer | Officer1234! | Officer |
| viewer | Viewer1234! | Viewer (read-only) |

4. Optional health check: `http://localhost:8080/actuator/health` should answer `{"status":"UP"}`.

**Change these passwords before using the system for anything other than a demonstration.** Create real staff accounts under *Users* (administrator only).

## 6. Run without Docker (development)

Requirements: JDK 21, Maven 3.9+, Node 18+, a local MySQL 8.

```powershell
# 1. database (once)
#    CREATE DATABASE cts_spring_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
#    CREATE USER 'cts_spring'@'%' IDENTIFIED BY '<password>';
#    GRANT ALL PRIVILEGES ON cts_spring_db.* TO 'cts_spring'@'%';

# 2. backend (terminal 1)
cd backend
$env:MYSQL_HOST="127.0.0.1"; $env:MYSQL_PORT="3306"
$env:MYSQL_DATABASE="cts_spring_db"; $env:MYSQL_USER="cts_spring"
$env:MYSQL_PASSWORD="<password>"; $env:JWT_SECRET="<long random string>"
mvn spring-boot:run

# 3. frontend (terminal 2)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** (plain HTTP). The development server forwards `/api` to the backend on port 8080.

## 7. Run the tests

```powershell
cd backend ; mvn test                      # 122 backend tests, no MySQL needed
cd ..\frontend ; npm install ; npm test    # 166 frontend tests
npx newman run docs/postman/CTS_API_Collection.json   # API tests, backend must be running
```

## 8. Daily operation

| Task | Command |
|---|---|
| Stop (keeps data) | `docker compose stop` |
| Start again | `docker compose start` |
| View logs | `docker compose logs -f backend` |
| Update after pulling new code | `git pull` then `docker compose up --build -d` |
| Wipe everything, including the database | `docker compose down -v` then `docker compose up --build -d` |

Uploaded files are stored in a Docker volume and the database in another; both survive `stop` and `up`, and are deleted only by `down -v`.

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `docker compose` cannot find `.env` values | Run it from the project root, where `.env` lives. |
| Port already in use | Stop the program using 3443, 8080 or 3307, or change the port mapping in `docker-compose.yml`. |
| Backend stays "starting" | MySQL is still initialising. Wait a minute, then run `docker compose logs backend`. |
| Browser says "connection not private" | Expected with the self-signed certificate; proceed past the warning. |
| Login fails five times and the account locks | The account is locked for 15 minutes by design; wait, or ask an administrator. |
| A role change does not take effect | The user must sign out and sign in again, because permissions are read at login. |
| Changes in the code do not appear | Rebuild: `docker compose up --build -d`. |

## 10. Known limitations of this deployment

- One database instance: no replica and no scheduled backup are configured.
- The certificate is self-signed.
- The system is a modular monolith (one backend service), not separate microservices.
