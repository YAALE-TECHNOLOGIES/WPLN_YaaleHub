import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text

def add_col():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE modules ADD COLUMN proficiency_mapping JSON DEFAULT NULL;"))
            conn.commit()
            print("Column added successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_col()
