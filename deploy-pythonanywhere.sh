#!/usr/bin/env bash
# Run inside a PythonAnywhere Bash console:   RESET=1 bash ~/CAPSTONE_PROJECT/deploy-pythonanywhere.sh
# RESET=1 wipes the LYDOP database first (use it for the first setup only).
set -e
USER_NAME="$(whoami)"
cd ~/CAPSTONE_PROJECT && git pull
cd backend
source ~/lydop-venv/bin/activate

rm -rf ~/.cache                      # pip cache: frees space on the 512 MB quota
pip install -q -r requirements-pythonanywhere.txt

if [ ! -f .env ]; then echo "backend/.env is missing - create it first (see DEPLOY-PYTHONANYWHERE.md)"; exit 1; fi
if grep -q '^SECRET_KEY=PASTE' .env; then
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(50))')|" .env
  echo "Generated a SECRET_KEY."
fi

python manage.py collectstatic --no-input
if [ "$RESET" = "1" ]; then rm -f db.sqlite3; fi
python manage.py migrate
python manage.py bootstrap_demo

WSGI="/var/www/${USER_NAME}_pythonanywhere_com_wsgi.py"
if [ -f "$WSGI" ] && ! grep -q CAPSTONE_PROJECT "$WSGI"; then
  cp "$WSGI" ~/wsgi_backup_before_lydop.py
  echo "Old WSGI file saved to ~/wsgi_backup_before_lydop.py"
fi
cat > "$WSGI" <<PY
import os
import sys

sys.path.insert(0, '/home/${USER_NAME}/CAPSTONE_PROJECT/backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
PY
echo
echo "Done. Now on the Web tab: set Virtualenv to /home/${USER_NAME}/lydop-venv, then press Reload."
