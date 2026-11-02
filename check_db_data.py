
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv(dotenv_path='d:/WPLN/backend/.env')

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+mysqlconnector://root@localhost/wpln_assessment")
engine = create_engine(DATABASE_URL)

def check_data():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT id, question_text, audio_script FROM questions WHERE audio_script IS NOT NULL AND audio_script != '' LIMIT 5"))
            rows = result.fetchall()
            print(f"Found {len(rows)} questions with audio_script.")
            for r in rows:
                print(f"ID: {r.id}, Text: {r.question_text[:20]}, Script: {r.audio_script[:20]}")
    except Exception as e:
        print(f"Check failed: {e}")

if __name__ == "__main__":
    check_data()
