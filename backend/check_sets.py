import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+mysqlconnector://root@localhost/wpln_assessment")
engine = create_engine(DATABASE_URL)

def run():
    try:
        with engine.connect() as conn:
            print("\n=== Writing Set 1 Questions ===")
            q_details = conn.execute(text("""
                SELECT q.id, q.question_type, q.question_text, q.display_type
                FROM questions q
                WHERE q.module_id = 3 AND q.question_set = 'set1'
                LIMIT 10
            """)).fetchall()
            for q in q_details:
                print(f"ID: {q[0]} | Type: {q[1]} | Text: {repr(q[2][:60])} | Display: {q[3]}")
                
    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    run()
