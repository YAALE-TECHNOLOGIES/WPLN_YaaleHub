#!/usr/bin/env bash
# ==============================================================================
# WPLN Online Assessment Platform - Automated Ubuntu Server Deployment Script
# Domain: wpln.yaaletech.in
# Backend Port: 8412
# ==============================================================================

set -e

APP_DIR="/var/www/wpln.yaaletech.in"
BACKEND_PORT=8412
DOMAIN="wpln.yaaletech.in"

echo "=========================================================="
echo " Starting WPLN Deployment on $DOMAIN (Backend Port: $BACKEND_PORT)"
echo "=========================================================="

# 1. Ensure system dependencies
echo ">>> [1/6] Checking system packages (Python, Node, Nginx, MySQL)..."
if ! command -v python3 &> /dev/null; then
    echo "Installing Python3 and venv..."
    sudo apt update && sudo apt install -y python3 python3-pip python3-venv
fi

if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt install -y nginx
fi

# 2. Setup Backend Python Environment
echo ">>> [2/6] Setting up Backend Python Virtual Environment..."
cd "$APP_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Ensure uploads directory structure exists
mkdir -p uploads/certificates uploads/modules uploads/questions uploads/speaking uploads/syllabus uploads/temp
sudo chown -R www-data:www-data "$APP_DIR/backend/uploads"
sudo chmod -R 775 "$APP_DIR/backend/uploads"

# Check .env
if [ ! -f ".env" ]; then
    echo "Creating backend .env from .env.example..."
    cp .env.example .env
    echo "IMPORTANT: Please edit $APP_DIR/backend/.env with your MySQL and credentials!"
fi

# 3. Setup Frontend Build
echo ">>> [3/6] Building Frontend React App..."
cd "$APP_DIR/frontend"

# Ensure production .env exists
cat <<EOF > .env.production
VITE_API_BASE_URL=https://$DOMAIN/api
EOF

npm install
npm run build

# Ensure web root permissions
sudo chown -R www-data:www-data "$APP_DIR/frontend/dist"

# 4. Setup Systemd Service
echo ">>> [4/6] Configuring Systemd Service for FastAPI on port $BACKEND_PORT..."
sudo cp "$APP_DIR/wpln-backend.service" /etc/systemd/system/wpln-backend.service
sudo systemctl daemon-reload
sudo systemctl enable wpln-backend
sudo systemctl restart wpln-backend

# 5. Setup Nginx Configuration
echo ">>> [5/6] Configuring Nginx..."
if [ -f "$APP_DIR/nginx_wpln.conf" ]; then
    sudo cp "$APP_DIR/nginx_wpln.conf" "/etc/nginx/sites-available/$DOMAIN"
    if [ ! -f "/etc/nginx/sites-enabled/$DOMAIN" ]; then
        sudo ln -s "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
    fi
    sudo nginx -t && sudo systemctl reload nginx
fi

# 6. Health Check
echo ">>> [6/6] Verifying Backend Health..."
sleep 3
if curl -s "http://127.0.0.1:$BACKEND_PORT/" | grep -q "WPLN"; then
    echo "=========================================================="
    echo " ✅ DEPLOYMENT SUCCESSFUL!"
    echo " Backend is running on http://127.0.0.1:$BACKEND_PORT"
    echo " Frontend is live at https://$DOMAIN"
    echo "=========================================================="
else
    echo "⚠️ Backend health check returned unexpected response. Check logs:"
    echo "  sudo journalctl -u wpln-backend -n 50 --no-pager"
fi
