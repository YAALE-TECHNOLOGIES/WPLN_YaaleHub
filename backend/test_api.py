import requests
from app.database import SessionLocal
from app.models.models import User
from app.core.auth import get_password_hash

# Set admin password to something known
db = SessionLocal()
admin = db.query(User).filter(User.email == 'admin@wpln.com').first()
if admin:
    admin.password_hash = get_password_hash('password123')
    db.commit()
db.close()

# 1. Login as admin
session = requests.Session()
login_res = session.post("http://127.0.0.1:8000/api/auth/login", data={"username": "admin@wpln.com", "password": "password123"})
if login_res.status_code == 200:
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Add question
    payload = {
        "module_id": 1,
        "questions": [
            {
                "question_type": "DRAG_DROP_ORDERING",
                "question_text": "Put sentences in order",
                "marks": 10,
                "order_index": 0,
                "display_type": "click",
                "drag_drop_data": {
                    "drag_items": ["Sentence 1", "Sentence 2"],
                    "drop_zones": [],
                    "correct_mapping": {}
                },
                "options": None,
                "audio_script": None,
                "media_url": None,
                "recording_duration": None
            }
        ]
    }
    
    res = session.post("http://127.0.0.1:8000/api/admin/questions/bulk", json=payload, headers=headers)
    print("Add question status:", res.status_code)
    print("Response:", res.text)
else:
    print("Login failed:", login_res.text)
