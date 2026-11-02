import os
import subprocess
import sys

def setup():
    print("Setting up WPLN Assessment System...")
    
    # 1. Backend setup
    print("\n[1/4] Installing Backend Dependencies...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", "backend/requirements.txt"])
    
    # 2. Frontend setup
    # print("\n[2/4] Installing Frontend Dependencies...")
    # subprocess.run(["npm", "install"], cwd="frontend")
    
    # 3. Database connection check
    # We assume 'wpln_assessment' exists and user/pass is root (no pass)
    # The models will automatically create tables on startup of main.py
    
    # 4. Starting services (Instructions)
    print("\n[Setup Complete!]")
    print("---")
    print("To start the BACKEND:   cd backend && python -m uvicorn app.main:app --reload")
    print("To start the FRONTEND:  cd frontend && npm run dev")
    print("---")
    print("The system will auto-seed Roles and 6 modules on first startup.")

if __name__ == "__main__":
    setup()
