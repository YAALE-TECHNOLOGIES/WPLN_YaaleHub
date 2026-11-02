from app.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Altering question_type enum...")
        conn.execute(text("ALTER TABLE questions MODIFY COLUMN question_type ENUM('MCQ', 'AUDIO_MCQ', 'WRITING_PROMPT', 'SPEAKING_PROMPT', 'DRAG_DROP', 'DRAG_DROP_ORDERING') NOT NULL"))
        conn.commit()
        print("Migration done.")

if __name__ == "__main__":
    run_migration()
