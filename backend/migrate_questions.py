"""Add order_index and recording_duration to questions table"""
import sys
sys.path.insert(0, '.')

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        # Check if columns exist first; MySQL uses INFORMATION_SCHEMA
        result = conn.execute(text("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' 
            AND COLUMN_NAME IN ('order_index', 'recording_duration')
        """))
        existing = {row[0] for row in result}
        
        if 'order_index' not in existing:
            conn.execute(text("ALTER TABLE questions ADD COLUMN order_index INT NOT NULL DEFAULT 0"))
            print("Added column: order_index")
        else:
            print("Column order_index already exists, skipping.")

        if 'recording_duration' not in existing:
            conn.execute(text("ALTER TABLE questions ADD COLUMN recording_duration INT NULL"))
            print("Added column: recording_duration")
        else:
            print("Column recording_duration already exists, skipping.")
        
        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
