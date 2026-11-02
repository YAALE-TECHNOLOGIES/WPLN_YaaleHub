from app.database import engine
from sqlalchemy import text

def migrate():
    print("Connecting to database...")
    with engine.connect() as con:
        try:
            print("Adding group_id column to questions table...")
            con.execute(text("ALTER TABLE questions ADD COLUMN group_id VARCHAR(100) NULL"))
            con.commit()
            print("Success: Column group_id added.")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("Note: Column group_id already exists.")
            else:
                print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
