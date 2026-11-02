from app.database import engine
from sqlalchemy import text
import sys

def sync():
    with engine.connect() as conn:
        try:
            # For MySQL
            res = conn.execute(text("SHOW COLUMNS FROM user_answers"))
            cols = [row[0] for row in res.fetchall()]
            
            # Add columns if missing
            if 'evaluation_status' not in cols:
                print("Adding evaluation_status column...")
                conn.execute(text("ALTER TABLE user_answers ADD COLUMN evaluation_status VARCHAR(50)"))
            
            if 'evaluated_by' not in cols:
                print("Adding evaluated_by column...")
                conn.execute(text("ALTER TABLE user_answers ADD COLUMN evaluated_by INT"))
                
            if 'evaluated_at' not in cols:
                print("Adding evaluated_at column...")
                conn.execute(text("ALTER TABLE user_answers ADD COLUMN evaluated_at DATETIME"))
                
            conn.commit()
            print("Database schema successfully synced!")
        except Exception as e:
            print(f"Error syncing DB: {e}")
            sys.exit(1)

if __name__ == "__main__":
    sync()
