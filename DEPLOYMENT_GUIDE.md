# WPLN Deployment Guide: Windows Server (Backend) + Vodien (Frontend)

This guide provides step-by-step instructions for deploying the WPLN Online Assessment Platform in a hybrid production environment:
- **Backend & MySQL**: Windows Server (running alongside existing applications)
- **Frontend**: Vodien Web Hosting (cPanel / Apache)

---

## 🏗 System Architecture Overview

```
                        [ Internet / User Browser ]
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v (HTTPS)                                               v (HTTPS)
+------------------------+                             +------------------------+
|    Vodien cPanel       |                             |     Windows Server     |
|  (Linux / Apache)      |                             | (2 Apps Already Running)|
|                        |                             |                        |
| - React (Vite Build)   |                             | - IIS / Cloudflared    |
| - .htaccess (SPA)      |                             |   Reverse Proxy (443)  |
| - Hosted on:           |                             |        |               |
|   https://wpln.domain  |                             |        v (127.0.0.1)   |
|                        |                             | - FastAPI (Port 8000)  |
|                        |                             |   (NSSM Windows Svc)   |
|                        |                             | - MySQL (Port 3306)    |
|                        |                             | - Uploads Directory    |
+------------------------+                             +------------------------+
```

> [!IMPORTANT]
> **HTTPS / Mixed Content Rule**:
> Modern browsers block API requests if an HTTPS site (e.g. `https://your-vodien-site.com`) calls an insecure HTTP backend (`http://...`). Therefore, the backend on your Windows Server **must be accessible over HTTPS** (e.g., `https://api.yourdomain.com`).

---

## 🪟 PART 1: Windows Server Setup (Backend & Database)

Since your Windows Server is already running **two applications**, we must ensure zero downtime and no port collisions for existing services.

### Step 1.1: Check and Choose an Available Port
Open PowerShell or Command Prompt as **Administrator** on the Windows Server:

```powershell
# Check which ports are currently in use
netstat -ano | findstr LISTENING
```

Common ports already taken might be `80`, `443`, `3000`, `5000`, `8080`.
Choose an unused port for WPLN FastAPI, for example: `8000` (or `8005`, `8010`).

---

### Step 1.2: Set Up MySQL Database
1. Open your MySQL client (MySQL Workbench, HeidiSQL, or MySQL CLI) on the Windows Server.
2. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS wpln_assessment CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   ```
3. Import the database dump provided in the project:
   ```powershell
   mysql -u root -p wpln_assessment < "C:\path\to\wpln_assessment_db_dump.sql"
   ```
   *(Replace with your MySQL username and actual path to `wpln_assessment_db_dump.sql`)*.

---

### Step 1.3: Deploy Backend Files to Windows Server
1. Create a dedicated folder for the application, e.g.:
   `C:\inetpub\wpln-backend` or `D:\Apps\wpln-backend`
2. Copy the following files & directories into this folder:
   ```
   wpln-backend/
   ├── app/                   # FastAPI source code
   ├── uploads/               # Audio, questions, and certificates storage
   ├── .env                   # Environment configuration
   └── requirements.txt       # Python dependencies
   ```
   > [!NOTE]
   > Make sure the `uploads` folder contains: `certificates`, `listening`, `modules`, `questions`, `speaking`, `syllabus`.

---

### Step 1.4: Install Python & Dependencies
1. Ensure Python 3.10+ or 3.11+ is installed on the server (check with `python --version`).
2. Open PowerShell in `C:\inetpub\wpln-backend`:
   ```powershell
   cd C:\inetpub\wpln-backend

   # Create an isolated virtual environment
   python -m venv venv

   # Activate the virtual environment
   .\venv\Scripts\Activate.ps1

   # Upgrade pip
   python -m pip install --upgrade pip

   # Install dependencies
   pip install -r requirements.txt
   ```

---

### Step 1.5: Configure `.env` on Windows Server
Create or edit `C:\inetpub\wpln-backend\.env`:

```ini
# Database Connection
DATABASE_URL=mysql+mysqlconnector://<DB_USER>:<DB_PASSWORD>@localhost:3306/wpln_assessment

# Email (SMTP) Settings
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# JWT Security
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OpenAI Key (for Speaking evaluation)
OPENAI_API_KEY=your_openai_key

# Frontend URL (For candidate email login links)
FRONTEND_URL=https://your-vodien-domain.com
```

Test running the server once manually:
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open a browser and verify `http://127.0.0.1:8000/docs`. If it loads, press `Ctrl+C` to stop.

---

### Step 1.6: Run FastAPI as a Windows Service (NSSM)
To keep the backend running 24/7 even after you log out of Remote Desktop, use **NSSM** (Non-Sucking Service Manager):

1. Download NSSM from [https://nssm.cc/download](https://nssm.cc/download) and place `nssm.exe` in `C:\Windows\System32`.
2. Open Command Prompt as Administrator and run:
   ```cmd
   nssm install WPLN-Backend
   ```
3. A GUI window will open. Fill in the fields:
   - **Path**: `C:\inetpub\wpln-backend\venv\Scripts\python.exe`
   - **Startup directory**: `C:\inetpub\wpln-backend`
   - **Arguments**: `-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2`
   - *(Optional) Under "I/O" tab*: set Output (stdout) to `C:\inetpub\wpln-backend\stdout.log` and Error (stderr) to `C:\inetpub\wpln-backend\stderr.log`.
4. Click **Install service**.
5. Start the service:
   ```cmd
   nssm start WPLN-Backend
   ```
   *(Or start it via `services.msc` -> find `WPLN-Backend` -> Right-click -> Start. Set Startup type to Automatic).*

---

### Step 1.7: Expose Backend via HTTPS (Reverse Proxy)

Since your frontend on Vodien will run on HTTPS, the backend MUST have HTTPS. Choose one of the two best methods below:

#### Method A: IIS Reverse Proxy (Recommended if IIS is already running on the server)
1. In IIS, make sure **URL Rewrite** and **Application Request Routing (ARR)** modules are installed.
2. In ARR: Open IIS Manager -> Click Server Node -> **Application Request Routing Cache** -> **Server Proxy Settings** -> Check **Enable proxy** -> Click **Apply**.
3. Create a new Website in IIS:
   - Site Name: `WPLN-API`
   - Physical Path: `C:\inetpub\wpln-backend`
   - Host Name: `api.yourdomain.com`
   - Port: `80` (and `443` with your SSL certificate).
4. In the site's `web.config`, add the reverse proxy rule:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <configuration>
       <system.webServer>
           <rewrite>
               <rules>
                   <rule name="ReverseProxyToFastAPI" stopProcessing="true">
                       <match url="(.*)" />
                       <action type="Rewrite" url="http://127.0.0.1:8000/{R:1}" />
                   </rule>
               </rules>
           </rewrite>
       </system.webServer>
   </configuration>
   ```
5. Bind a free SSL certificate to `api.yourdomain.com` using **win-acme** (Let's Encrypt for Windows IIS).

#### Method B: Cloudflare Tunnel (Easiest - No open ports, No firewall configuration)
If you do not want to configure IIS or router port forwarding:
1. In your Cloudflare dashboard, go to **Zero Trust** -> **Networks** -> **Tunnels**.
2. Create a tunnel named `wpln-tunnel`.
3. Run the provided command on your Windows Server to install `cloudflared` as a service.
4. In the Tunnel settings, route `api.yourdomain.com` to `HTTP://localhost:8000`.
5. Cloudflare automatically provides free SSL and DDoS protection!

---

## 🌐 PART 2: Vodien Deployment (Frontend)

Vodien is a standard cPanel / Linux Apache web host. We will build the React application locally and upload the static production files.

### Step 2.1: Configure Frontend Production API URL
On your development machine:
1. Open `frontend/.env` (or create `frontend/.env.production`):
   ```ini
   VITE_API_BASE_URL=https://api.yourdomain.com/api
   ```
   *(Replace `https://api.yourdomain.com` with your real backend domain or Cloudflare Tunnel URL).*

---

### Step 2.2: Build the React Application
In PowerShell/Terminal, navigate to the `frontend` directory:

```powershell
cd d:\WPLN\frontend
npm run build
```

This compiles your React code into the `d:\WPLN\frontend\dist` folder.

---

### Step 2.3: Verify `.htaccess` in `dist/`
A `.htaccess` file is required so that refreshing pages like `/login`, `/dashboard`, or `/WPLNadmin` on Apache/Vodien does not result in a `404 Not Found` error.

The build process automatically copies `frontend/public/.htaccess` to `dist/.htaccess`:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```
*Verify that `d:\WPLN\frontend\dist\.htaccess` exists.*

---

### Step 2.4: Upload to Vodien cPanel
1. Compress all files **INSIDE** `frontend\dist\` into a ZIP file (e.g., `dist.zip`).
   > [!NOTE]
   > Do not zip the `dist` folder itself; select the files inside (`index.html`, `assets/`, `.htaccess`, etc.) and zip them.
2. Log in to your **Vodien Account** -> open **cPanel**.
3. In cPanel, click **File Manager**.
4. Navigate to:
   - If hosting on the primary domain: `public_html/`
   - If hosting on a subdomain (e.g. `assess.yourdomain.com`): `public_html/assess/` (or the folder mapped to the subdomain).
5. Click **Upload** at the top and upload `dist.zip`.
6. Once uploaded, right-click `dist.zip` -> **Extract** -> Extract to the current directory.
7. Verify that `index.html` and `.htaccess` are directly in the root of your web directory (enable "Show Hidden Files" in File Manager settings if you don't see `.htaccess`).

---

### Step 2.5: Ensure SSL is Active on Vodien
1. In Vodien cPanel, search for **SSL/TLS Status**.
2. Check that your domain has a valid **AutoSSL** (green padlock).
3. If not active, select your domain and click **Run AutoSSL**.

---

## 🔍 PART 3: Verification & Health Check

1. **Verify Backend API**:
   - Open `https://api.yourdomain.com/` in your browser.
   - You should see: `{"message": "WPLN Assessment System API is online"}`.
   - Open `https://api.yourdomain.com/docs` to verify Swagger documentation.
2. **Verify Frontend**:
   - Open `https://your-vodien-domain.com`.
   - Test logging in:
     - Admin: `admin@wpln.com` / `admin123`
   - Test navigating to `/dashboard`, `/WPLNadmin`, and refresh the page (F5) to verify client-side routing works without 404 errors.
3. **Verify Uploads & Media**:
   - In Admin panel, create a question with audio or image media.
   - Confirm that media plays and saves to `uploads/` on the Windows Server.
4. **Verify Speaking Test**:
   - In Candidate view, run a speaking assessment test, record audio, and submit.
   - Verify audio uploads successfully to `uploads/speaking/`.

---

## 🛠 Troubleshooting Common Issues

| Issue | Cause | Solution |
|---|---|---|
| **CORS Error in Browser** | Browser blocks cross-origin requests | Ensure backend `allow_origins=["*"]` or includes `https://your-vodien-domain.com`. |
| **Mixed Content Error** | Frontend is HTTPS but API URL is `http://` | Ensure `VITE_API_BASE_URL` uses `https://` and SSL is properly configured on the backend domain. |
| **404 on page refresh on Vodien** | Missing `.htaccess` rewrite rule | Ensure `.htaccess` is uploaded to the root of `public_html` (enable "Show Hidden Files" in cPanel). |
| **Backend stops when logging out of RDP** | Running in a standard CMD window | Use **NSSM** (Step 1.6) to install FastAPI as a persistent Windows Service. |
| **File upload permission error** | Service account lacks write access to `uploads/` | Right-click `uploads/` folder -> Properties -> Security -> Give `Modify` permissions to `IUSR` / `LOCAL SERVICE` / `SYSTEM`. |
