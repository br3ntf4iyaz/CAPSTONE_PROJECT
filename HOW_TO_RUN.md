# Lucena City Youth Development Portal — Setup & Run Guide

## Two Portals

| Portal | URL | Who Uses It |
|--------|-----|-------------|
| Youth Portal | http://localhost:5173/ | SK, Youth Leaders, General Youth |
| Admin Portal | http://localhost:5173/admin/login | LGU Admin, Super Admin ONLY |

**The Admin Portal is never linked from the Youth Portal.**

---

## Prerequisites
- Python 3.10+ — https://python.org
- Node.js 18+  — https://nodejs.org
- VS Code       — https://code.visualstudio.com

---

## First-Time Setup (run once)

### Terminal 1 — Backend
Open VS Code → `Ctrl + `` ` `` ` → type:

```bash
cd C:\Users\Matthew\Thesis_App\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
```

### Terminal 2 — Frontend
Open second terminal → `Ctrl + Shift + `` ` `` `:

```bash
cd C:\Users\Matthew\Thesis_App\frontend
npm install
```

---

## Daily Run (every time you work on the project)

**Terminal 1:**
```bash
cd C:\Users\Matthew\Thesis_App\backend
venv\Scripts\activate
python manage.py runserver
```

**Terminal 2:**
```bash
cd C:\Users\Matthew\Thesis_App\frontend
npm run dev
```

---

## Demo Login Credentials

### Youth Portal — http://localhost:5173/
| Youth Type | Email | Password |
|------------|-------|----------|
| SK Member | youth1@gmail.com | Youth123! |
| SK Member | youth2@gmail.com | Youth123! |
| Youth Org Leader | youth3@gmail.com | Youth123! |
| General Youth | youth4@gmail.com | Youth123! |

### Admin Portal — http://localhost:5173/admin/login
| Role | Email | Password |
|------|-------|----------|
| LGU Admin | admin@lucena.gov.ph | LGUAdmin123! |
| Super Admin | super@lucena.gov.ph | SuperAdmin123! |

---

## Features by Portal

### Youth Portal (/)
- Public landing page with featured programs
- Registration & Login
- Project/Program Monitoring (10 categories)
- Calendar of Activities
- Learning Management System (LMS)
- AI Chatbot (FAQ assistant)
- Job Opportunities
- School & College Directory
- Youth Organization Directory (YORP)
- SK Barangay Directory
- Library (Laws, Plans, Ordinances)
- Program/Activity Submissions (PDF upload)
- Surveys & Polls

### Admin Portal (/admin)
- Admin Dashboard with stats & charts
- Project Monitoring (with gender breakdown)
- Youth Org / YORP Management (checklist)
- SK Requirements Tracker (10 per barangay)
- Data Analytics (bar, pie, line charts)
- Calendar & Event Management
- LMS Content Management
- Survey Management
- User Management
- Library Management
- Jobs & Schools Management
- Notification System

---

## Reset Demo Data

```bash
cd C:\Users\Matthew\Thesis_App\backend
venv\Scripts\activate
del db.sqlite3
python manage.py migrate
python manage.py seed_data
```

---

## Troubleshooting

### White screen / page not loading
```bash
cd frontend
npm install
npm run dev
```
Then open browser DevTools (F12) → Console tab for errors.

### "ModuleNotFoundError" on backend
```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
```

### Login fails
Make sure backend is running (`python manage.py runserver` shows port 8000).

### AI Chatbot not responding
The chatbot needs an Anthropic API key. Add it to `backend/.env`:
```
ANTHROPIC_API_KEY=your-key-here
```
Without it, the chatbot shows a polite fallback message.

---

## API Endpoints (for reference)

| Module | Endpoint |
|--------|----------|
| Auth | /api/auth/ |
| Courses / LMS | /api/courses/ |
| Events / Calendar | /api/events/ |
| Programs | /api/programs/ |
| Youth Organizations | /api/youth-orgs/ |
| SK Requirements | /api/sk-requirements/ |
| Jobs | /api/jobs/ |
| Schools | /api/schools/ |
| Chatbot | /api/chatbot/ |
| Compliance | /api/compliance/ |
| Notifications | /api/notifications/ |

Django Admin: http://127.0.0.1:8000/admin/
(Login: super@lucena.gov.ph / SuperAdmin123!)

---

## Project Structure

```
Thesis_App/
├── backend/
│   ├── apps/
│   │   ├── accounts/       Users, auth, RBAC
│   │   ├── courses/        LMS
│   │   ├── events/         Calendar, polls, surveys
│   │   ├── programs/       Program/Project/Activity monitoring
│   │   ├── youth_orgs/     YORP — Youth Organization Directory
│   │   ├── sk_requirements/ SK compliance tracker
│   │   ├── jobs/           Job opportunities
│   │   ├── schools/        School directory
│   │   ├── resources/      Library / resource center
│   │   ├── compliance/     SK compliance records
│   │   ├── notifications/  In-app notifications
│   │   ├── chatbot/        AI chatbot (Claude API)
│   │   └── support/        FAQ, tickets
│   ├── config/             Django settings & URLs
│   └── manage.py
│
└── frontend/
    └── src/
        ├── portals/
        │   ├── youth/      Youth Portal pages & layout
        │   └── admin/      Admin Portal pages & layout
        ├── api/            API client & functions
        ├── components/     Shared UI components
        ├── hooks/          Auth hooks
        ├── store/          Auth store
        └── types/          TypeScript types
```
