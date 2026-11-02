from app.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Altering question_type enum...")
        conn.execute(text("ALTER TABLE questions MODIFY COLUMN question_type ENUM('MCQ', 'AUDIO_MCQ', 'WRITING_PROMPT', 'SPEAKING_PROMPT', 'DRAG_DROP') NOT NULL"))
        print("Altering display_type enum...")
        conn.execute(text("ALTER TABLE questions MODIFY COLUMN display_type ENUM('click', 'select') NOT NULL DEFAULT 'click'"))
        conn.commit()
        print("Migration done.")

if __name__ == "__main__":
    run_migration()
