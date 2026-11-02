import sqlite3
import os

db_path = "d:/WPLN/backend/wpln.db" # Standard path based on project structure or common defaults

def migrate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE modules ADD COLUMN begin_speaking_audio_url VARCHAR(255)")
        print("Added begin_speaking_audio_url column")
    except sqlite3.OperationalError:
        print("begin_speaking_audio_url already exists")

    try:
        cursor.execute("ALTER TABLE modules ADD COLUMN speaking_recording_duration INTEGER")
        print("Added speaking_recording_duration column")
    except sqlite3.OperationalError:
        print("speaking_recording_duration already exists")

    conn.commit()
    conn.close()
    print("Migration complete")

if __name__ == "__main__":
    migrate()
