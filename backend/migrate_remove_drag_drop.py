from app.database import engine
from sqlalchemy import text

# This script updates the question_type ENUM to remove 'DRAG_DROP'
# MySQL specific: ALTER TABLE questions MODIFY COLUMN question_type ENUM(...)

try:
    with engine.connect() as conn:
        print("Updating question_type ENUM...")
        conn.execute(text("ALTER TABLE questions MODIFY COLUMN question_type ENUM('MCQ', 'AUDIO_MCQ', 'WRITING_PROMPT', 'SPEAKING_PROMPT', 'DRAG_DROP_ORDERING')"))
        conn.commit()
        print("Success! 'DRAG_DROP' removed from ENUM.")
except Exception as e:
    print(f"Error during migration: {e}")
