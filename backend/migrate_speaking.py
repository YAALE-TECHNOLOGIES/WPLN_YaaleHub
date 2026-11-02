import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE modules ADD COLUMN begin_speaking_audio_url VARCHAR(255)"))
            print("Added begin_speaking_audio_url column")
        except Exception as e:
            print(f"Column begin_speaking_audio_url might already exist: {e}")

        try:
            conn.execute(text("ALTER TABLE modules ADD COLUMN speaking_recording_duration INTEGER"))
            print("Added speaking_recording_duration column")
        except Exception as e:
            print(f"Column speaking_recording_duration might already exist: {e}")
        
        conn.commit()

if __name__ == "__main__":
    migrate()
