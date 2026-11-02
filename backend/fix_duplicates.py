from app.database import engine
from sqlalchemy import text

def add_unique_constraint():
    with engine.connect() as con:
        # First check if constraint already exists
        try:
            r = con.execute(text("""
                SELECT COUNT(*) as cnt FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_NAME='user_answers'
                AND CONSTRAINT_NAME='uq_attempt_question'
                AND TABLE_SCHEMA=DATABASE()
            """))
            exists = r.fetchone()[0]
            if exists:
                print("Unique constraint already exists.")
                return

            # Clean ALL duplicates across all attempts first
            print("Cleaning all duplicates across all attempts...")
            con.execute(text("""
                DELETE ua FROM user_answers ua
                INNER JOIN (
                    SELECT attempt_id, question_id, MAX(id) as max_id
                    FROM user_answers
                    GROUP BY attempt_id, question_id
                ) keeper ON ua.attempt_id = keeper.attempt_id
                    AND ua.question_id = keeper.question_id
                WHERE ua.id < keeper.max_id
            """))
            con.commit()
            print("Duplicates cleaned.")

            # Add unique constraint
            con.execute(text("""
                ALTER TABLE user_answers
                ADD CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
            """))
            con.commit()
            print("Unique constraint added successfully.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    add_unique_constraint()
