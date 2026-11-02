from app.database import engine
from sqlalchemy import text

def check_duplicates():
    with engine.connect() as con:
        print("=== Duplicate user_answers check ===")
        result = con.execute(text("""
            SELECT attempt_id, question_id, COUNT(*) as cnt
            FROM user_answers
            WHERE attempt_id = 44
            GROUP BY attempt_id, question_id
            ORDER BY question_id
        """))
        for row in result:
            flag = " <-- DUPLICATE!" if row.cnt > 1 else ""
            print(f"  attempt={row.attempt_id}, question={row.question_id}, count={row.cnt}{flag}")

        print("\n=== All user_answers rows for attempt 44 ===")
        result2 = con.execute(text("""
            SELECT id, attempt_id, question_id, selected_option_id, marks_obtained
            FROM user_answers
            WHERE attempt_id = 44
            ORDER BY question_id, id
        """))
        for row in result2:
            print(f"  row_id={row.id}, attempt={row.attempt_id}, question={row.question_id}, option={row.selected_option_id}, marks={row.marks_obtained}")

if __name__ == "__main__":
    check_duplicates()
