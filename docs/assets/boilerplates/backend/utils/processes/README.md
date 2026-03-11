# Process Scripts

Utility scripts for timesheet application operations.

## User Management

### `users/bootstrap-admin.sh` ⭐ **START HERE**

**Creates the first ADMIN user and gets the admin token automatically.**

**Usage:**
```bash
./users/bootstrap-admin.sh [email] [name] [password]
```

**What it does:**
1. Creates a USER via public signup
2. Automatically upgrades role to ADMIN in database (requires psql)
3. Logs in and returns the admin token

**Example:**
```bash
./users/bootstrap-admin.sh admin@example.com "Admin User" "Admin1234!"
```

**Output:**
- Admin credentials (email/password)
- Admin JWT token (use for `ADMIN_TOKEN` env var)
- Ready-to-use commands for creating MANAGER/ADMIN users

**Requirements:**
- Backend API running on `http://localhost:3002`
- Database accessible (will try auto-update, or prompts for manual SQL)

**Environment Variables:**
- `API_URL` - Backend API URL (default: `http://localhost:3002/api/v1`)
- `DB_URI` - Full PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/dbname`)
- `DB_NAME` - Database name (default: `tm-dev`, used if `DB_URI` not set)
- `DB_USER` - Database user (default: `postgres`, used if `DB_URI` not set)

**If psql is not available:**
The script will show the SQL command to run manually. You can also use:
- Docker: `docker exec -it <postgres-container> psql ...`
- Any PostgreSQL client (pgAdmin, DBeaver, etc.)

---

### `users/create-admin.sh`

**Legacy helper** - use `bootstrap-admin.sh` instead. This only creates USER and shows manual steps.

### `users/register-user.sh`

Register a new user account with role selection.

**Usage:**
```bash
./users/register-user.sh [email] [name] [password] [role]
```

**Parameters:**
- `email` - User email (default: auto-generated)
- `name` - User name (default: auto-generated)
- `password` - User password (default: "Test1234!")
- `role` - User role: `USER`, `MANAGER`, or `ADMIN` (default: `USER`)

**Examples:**
```bash
# Register regular USER (public signup, no auth needed)
./users/register-user.sh john@example.com "John Doe" "Test1234!" USER

# Register MANAGER (requires admin token)
ADMIN_TOKEN="eyJhbGc..." ./users/register-user.sh manager@example.com "Manager" "Test1234!" MANAGER

# Register ADMIN (requires admin token, will prompt if not in env)
./users/register-user.sh admin@example.com "Admin User" "Test1234!" ADMIN

# Register with defaults (USER role)
./users/register-user.sh
```

**Environment Variables:**
- `API_URL` - Backend API URL (default: `http://localhost:3002/api/v1`)
- `ADMIN_TOKEN` - Admin JWT token (required for MANAGER/ADMIN roles, optional - will prompt if missing)

**Output:**
- Returns user object on success (HTTP 201)
- For USER role: Also returns JWT `accessToken`
- Shows error message on failure (HTTP 400/403/409)

**Role-Based Access:**
- `USER` - Public signup via `/auth/signup` (no token needed)
- `MANAGER` - Admin-only via `/users` (requires admin token)
- `ADMIN` - Admin-only via `/users` (requires admin token)
