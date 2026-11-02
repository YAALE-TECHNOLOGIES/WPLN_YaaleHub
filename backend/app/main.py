from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from datetime import timedelta
import os

from .database import engine, get_db, Base, SessionLocal
from .models import Role, Module, RoleNames, Question, QuestionOption, QuestionType
from .api import auth_router, candidate_router, admin_router

app = FastAPI(title="WPLN Assessment API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .core.auth import get_password_hash
from .models.models import User

# Seed basic data
def seed_db():
    db = SessionLocal()
    try:
        # 1. Create Roles
        for role_name in [RoleNames.ADMIN, RoleNames.EVALUATOR, RoleNames.CANDIDATE]:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                db.add(Role(name=role_name))
        db.commit()

        # 2. Create Default Admin User
        admin_role = db.query(Role).filter(Role.name == RoleNames.ADMIN).first()
        admin_user = db.query(User).filter(User.email == "admin@wpln.com").first()
        if not admin_user:
            db.add(User(
                fullname="System Admin",
                email="admin@wpln.com",
                password_hash=get_password_hash("admin123"),
                role_id=admin_role.id
            ))
        
        # 3. Create Modules & Questions
        modules_data = [
            {"name": "Speaking", "type": QuestionType.SPEAKING_PROMPT, "text": "Describe your favorite hobby and why you enjoy it."},
            {"name": "Listening", "type": QuestionType.AUDIO_MCQ, "text": "What was the main topic of the recording?"},
            {"name": "Writing", "type": QuestionType.WRITING_PROMPT, "text": "Write a short essay about the impact of technology on education."},
            {"name": "Reading", "type": QuestionType.MCQ, "text": "What is the author's tone in the second paragraph?"},
            {"name": "Grammar & Vocabulary", "type": QuestionType.MCQ, "text": "Choose the correct verb form for: 'She ___ to the store yesterday'."},
            {"name": "Numeracy", "type": QuestionType.MCQ, "text": "What is 25% of 80?"}
        ]
        
        for m_info in modules_data:
            m_name = m_info["name"]
            module = db.query(Module).filter(Module.name == m_name).first()
            if not module:
                module = Module(
                    name=m_name,
                    description="",
                    duration_minutes=30 if m_name != "Speaking" else 15,
                    pass_marks=50,
                    total_marks=100
                )
                db.add(module)
                db.commit()
                db.refresh(module)
                
                # Add a sample question for each
                q = Question(
                    module_id=module.id,
                    question_type=m_info["type"],
                    question_text=m_info["text"],
                    marks=10,
                    question_set='set1'
                )
                db.add(q)
                db.commit()
                db.refresh(q)
                
                if m_info["type"] in [QuestionType.MCQ, QuestionType.AUDIO_MCQ]:
                    # Add options
                    opts = ["Option A", "Option B", "Option C", "Option D"]
                    for i, opt_text in enumerate(opts):
                        db.add(QuestionOption(
                            question_id=q.id,
                            option_text=opt_text,
                            is_correct=(i == 0)
                        ))
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def auto_sync_schema():
    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        with engine.begin() as conn:
            # 1. users table
            if 'users' in existing_tables:
                user_cols = [c['name'] for c in inspector.get_columns('users')]
                if 'education' not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN education VARCHAR(100) NULL"))
                    print("Added 'education' column to users table")
                if 'batch' not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN batch VARCHAR(100) NULL"))
                    print("Added 'batch' column to users table")
                if 'assigned_set' not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN assigned_set VARCHAR(20) NOT NULL DEFAULT 'set1'"))
                    print("Added 'assigned_set' column to users table")
                conn.execute(text("UPDATE users SET assigned_set = 'set1' WHERE assigned_set IS NULL"))

            # 2. modules table
            if 'modules' in existing_tables:
                mod_cols = [c['name'] for c in inspector.get_columns('modules')]
                if 'module_type' not in mod_cols:
                    conn.execute(text("ALTER TABLE modules ADD COLUMN module_type VARCHAR(50) NULL"))
                if 'begin_speaking_audio_url' not in mod_cols:
                    conn.execute(text("ALTER TABLE modules ADD COLUMN begin_speaking_audio_url VARCHAR(500) NULL"))
                if 'speaking_recording_duration' not in mod_cols:
                    conn.execute(text("ALTER TABLE modules ADD COLUMN speaking_recording_duration INT NULL DEFAULT 30"))
                if 'proficiency_mapping' not in mod_cols:
                    conn.execute(text("ALTER TABLE modules ADD COLUMN proficiency_mapping JSON NULL"))

            # 3. questions table
            if 'questions' in existing_tables:
                q_cols = [c['name'] for c in inspector.get_columns('questions')]
                if 'question_set' not in q_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN question_set VARCHAR(20) NOT NULL DEFAULT 'set1'"))
                if 'display_type' not in q_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN display_type VARCHAR(50) NULL"))
                if 'drag_drop_data' not in q_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN drag_drop_data JSON NULL"))
                if 'group_id' not in q_cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN group_id INT NULL"))

            # 4. test_attempts table
            if 'test_attempts' in existing_tables:
                ta_cols = [c['name'] for c in inspector.get_columns('test_attempts')]
                if 'question_set' not in ta_cols:
                    conn.execute(text("ALTER TABLE test_attempts ADD COLUMN question_set VARCHAR(20) NOT NULL DEFAULT 'set1'"))
                if 'is_published' not in ta_cols:
                    conn.execute(text("ALTER TABLE test_attempts ADD COLUMN is_published BOOLEAN DEFAULT FALSE"))
                if 'is_locked' not in ta_cols:
                    conn.execute(text("ALTER TABLE test_attempts ADD COLUMN is_locked BOOLEAN DEFAULT FALSE"))
                conn.execute(text("UPDATE test_attempts SET question_set = 'set1' WHERE question_set IS NULL"))
    except Exception as e:
        print(f"Auto-sync schema warning: {e}")

def ensure_question_set_column():
    pass

def ensure_user_assigned_set_column():
    pass

def ensure_testattempt_question_set_column():
    pass

@app.get("/api/candidate/all-modules", tags=["candidate"])
def get_public_modules_direct(db: Session = Depends(get_db)):
    print("DIRECT API ACCESSED: /api/candidate/all-modules")
    from .models.models import Module
    return db.query(Module).all()

@app.on_event("startup")
async def startup_event():
    try:
        Base.metadata.create_all(bind=engine)
        auto_sync_schema()
        seed_db()
    except Exception as e:
        print(f"DB Error: {e}")
    
    if not os.path.exists("./uploads"):
        os.makedirs("./uploads")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
async def root():
    return {"message": "WPLN Assessment System API is online"}

app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(candidate_router.router, prefix="/api/candidate", tags=["candidate"])
app.include_router(admin_router.router, prefix="/api/admin", tags=["admin"])
