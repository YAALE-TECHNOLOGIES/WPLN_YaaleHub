from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    res = conn.execute(text("SHOW COLUMNS FROM questions LIKE 'question_type'")).fetchone()
    print("Column Type:", res[1])  # The Type is usually at index 1
