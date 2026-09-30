# 🗓 Team Leave Tracker

A lightweight, responsive web application for managing and viewing team leave records.

**No backend server required.** The frontend communicates directly with [Supabase](https://supabase.com) (hosted PostgreSQL), and the app is deployed via **GitHub Pages**.

---

## Features

| Feature | Details |
|---|---|
| **Dashboard** | Summary stats, on-leave-today list, upcoming leave (30 days) |
| **Calendar** | Month & week view, per-employee/type/department filters |
| **Leave Records** | Add, edit, delete leave with working-day calculation |
| **Team Members** | Add, edit, activate/deactivate members |
| **Leave History** | Search, filter, sort all historical records |
| **Leave Types** | Custom types with color picker |
| **Public Holidays** | Holiday management (auto-excluded from working-day calc) |
| **Settings** | Supabase config helper & connection tester |
| **Responsive** | Works on desktop, tablet, and mobile |

---

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES2020+)
- **Database:** Supabase (PostgreSQL)
- **Hosting:** GitHub Pages
- **No build step, no npm, no framework** — open the HTML files directly

---

## Quick Start

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account.
2. Click **New Project** and fill in the details.
3. Wait for the project to be ready (~1 minute).

### 2. Run the Database Schema

1. In your Supabase project, go to **SQL Editor**.
2. Click **New Query**.
3. Copy and paste the contents of [`supabase/schema.sql`](supabase/schema.sql).
4. Click **Run**.

### 3. (Optional) Load Sample Data

1. In the SQL Editor, create another new query.
2. Copy and paste the contents of [`supabase/seed.sql`](supabase/seed.sql).
3. Click **Run**.

This will add:
- 8 sample team members
- 5 leave types (Annual, Sick, Emergency, Unpaid, Other)
- Public holidays for 2025 and 2026
- 4 sample leave records

### 4. Configure the Application

1. In Supabase, go to **Settings → API**.
2. Copy your **Project URL** and **anon/public key**.
3. Open `js/supabase.js` in your text editor.
4. Replace the placeholder values:

```javascript
const SUPABASE_URL      = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

---

## Deploy to GitHub Pages

### Step 1: Create a GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit: Team Leave Tracker"
```

Create a new repository on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your GitHub repository.
2. Click **Settings** → **Pages** (left sidebar).
3. Under **Source**, select **Deploy from a branch**.
4. Select branch: `main`, folder: `/ (root)`.
5. Click **Save**.

### Step 3: Access Your App

After a few seconds, GitHub Pages will provide a URL like:

```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

> **Note:** If you see an "index.html" page first, it will auto-redirect to the Dashboard.

---

## Project Structure

```
team-leave-tracker/
│
├── index.html                 # Entry point (redirects to dashboard)
│
├── css/
│   ├── style.css              # Main stylesheet
│   └── responsive.css         # Mobile/tablet breakpoints
│
├── js/
│   ├── supabase.js            # ← Edit this file with your credentials
│   ├── utils.js               # Shared helpers (toasts, modals, dates)
│   ├── dashboard.js           # Dashboard logic
│   ├── calendar.js            # Calendar (month + week view)
│   ├── leave.js               # Leave CRUD
│   ├── team.js                # Team member management
│   ├── history.js             # Leave history + filters
│   ├── leave-types.js         # Leave types management
│   └── holidays.js            # Public holidays management
│
├── pages/
│   ├── dashboard.html
│   ├── calendar.html
│   ├── leave.html
│   ├── team.html
│   ├── history.html
│   ├── leave-types.html
│   ├── holidays.html
│   └── settings.html
│
└── supabase/
    ├── schema.sql             # Run this first — creates all tables + RLS
    └── seed.sql               # Optional — sample data
```

---

## Database Schema

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | Primary key |
| full_name | TEXT | Required |
| email | TEXT | Unique |
| department | TEXT | |
| is_active | BOOLEAN | Default: true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `leave_types`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | Primary key |
| name | TEXT | Unique |
| description | TEXT | |
| color | TEXT | Hex color, e.g. `#3b82f6` |
| is_active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

### `leave_records`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | Primary key |
| employee_id | BIGINT | → profiles.id |
| leave_type_id | BIGINT | → leave_types.id |
| start_date | DATE | |
| end_date | DATE | |
| number_of_days | NUMERIC(5,1) | Calculated (Mon–Fri minus holidays) |
| reason | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `public_holidays`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | Primary key |
| name | TEXT | |
| date | DATE | |
| year | INTEGER | Generated from date |
| created_at | TIMESTAMPTZ | |

---

## Working Day Calculation

The `calculateWorkingDays(startDate, endDate)` function in `js/utils.js`:

- Counts **Monday through Friday**
- Excludes **Saturdays and Sundays**
- Excludes all **configured public holidays** (fetched from Supabase)

The result is stored in `leave_records.number_of_days` and recalculated every time dates change.

---

## Row-Level Security (RLS)

RLS is enabled on all tables, with open policies for both the `anon` and `authenticated` roles. This means any visitor can read and write all data without logging in — suitable for a trusted internal team tool.

> If you need to restrict access in the future, you can add authentication via Supabase Auth and update the RLS policies accordingly.

---

## Local Development

You can run the application locally with any static file server. For example:

**Using Python:**
```bash
cd team-leave-tracker
python -m http.server 8080
# Open http://localhost:8080
```

**Using Node.js (npx serve):**
```bash
cd team-leave-tracker
npx serve .
```

**Using VS Code Live Server:** Right-click `index.html` → Open with Live Server.

> Do **not** open HTML files directly using `file://` — the Supabase client requires HTTP.

---

## Customisation

### Add a new department
No configuration needed — just type any department name when adding a team member.

### Add a new leave type
Go to **Leave Types → Add Leave Type** and pick a color.

### Add public holidays for your country
Go to **Public Holidays → Add Holiday** and enter the date and name.

### Change the app name/logo
Edit the `<div class="sidebar-brand">` section in any HTML page.

---

## Limitations

- No authentication or login — suitable for internal team tools only
- All users share the same view and access
- No leave approval workflow
- No leave balance tracking

---

## License

MIT — free to use and modify.
