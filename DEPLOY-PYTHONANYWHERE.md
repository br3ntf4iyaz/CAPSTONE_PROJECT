# Deploying the backend on PythonAnywhere (free)

The frontend stays on Vercel. Vercel forwards `/api` and `/media` to PythonAnywhere (see `frontend/vercel.json`).
Replace `USERNAME` everywhere with your PythonAnywhere username.

## 1. Account and code
1. Sign up (free "Beginner" account) at https://www.pythonanywhere.com.
2. Open **Consoles → Bash** and run:

```bash
git clone https://github.com/br3ntf4iyaz/CAPSTONE_PROJECT.git
cd CAPSTONE_PROJECT/backend
python3.11 -m venv ~/venv
source ~/venv/bin/activate
pip install -r requirements-pythonanywhere.txt
```

If the repository is private, clone with a GitHub personal access token as the password.

## 2. Settings file
Still in `CAPSTONE_PROJECT/backend`, create `.env` (use your own values):

```bash
cat > .env <<'ENV'
DEBUG=False
SECRET_KEY=PASTE-A-LONG-RANDOM-STRING
ALLOWED_HOSTS=USERNAME.pythonanywhere.com
CSRF_TRUSTED_ORIGINS=https://capstone-project-ten-mu.vercel.app
CORS_ALLOWED_ORIGINS=https://capstone-project-ten-mu.vercel.app
FRONTEND_URL=https://capstone-project-ten-mu.vercel.app
DEMO_PASSWORD=PICK-A-PASSWORD-FOR-ALL-DEMO-ACCOUNTS
ENV
```

Generate a secret key with: `python -c "import secrets; print(secrets.token_urlsafe(50))"`

## 3. Database and demo data
```bash
python manage.py collectstatic --no-input
python manage.py migrate
python manage.py bootstrap_demo
```

`bootstrap_demo` loads the demo data once and sets every demo account (`super@lucena.gov.ph`,
`admin@lucena.gov.ph`, `youth1`..`youth10@gmail.com`) to your `DEMO_PASSWORD`.

## 4. Web app
1. Go to the **Web** tab → **Add a new web app** → **Manual configuration** → **Python 3.11**.
2. **Virtualenv:** `/home/USERNAME/venv`
3. Open the **WSGI configuration file** link, delete its contents, and paste:

```python
import os
import sys

sys.path.insert(0, '/home/USERNAME/CAPSTONE_PROJECT/backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

4. Click **Reload**. Check `https://USERNAME.pythonanywhere.com/api/stats/public/` returns JSON.

## 5. Connect the frontend
Send the `USERNAME.pythonanywhere.com` URL so `frontend/vercel.json` can point at it, then push.

## Notes
- Uploaded files and the SQLite database live on PythonAnywhere's disk and survive restarts.
- Free apps must be renewed with the **Run until 3 months from today** button on the Web tab.
- Outbound internet is limited to an allow-list, so the optional Polygon (EVM) anchoring will not work; the local ledger does.
- To update later: `cd ~/CAPSTONE_PROJECT && git pull`, then `python backend/manage.py migrate` and Reload.
