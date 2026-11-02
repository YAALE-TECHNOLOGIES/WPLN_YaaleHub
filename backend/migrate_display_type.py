import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+mysqlconnector://root@localhost/wpln_assessment")

engine = create_engine(DATABASE_URL)

def run_migration():
    print(f"Connecting to {DATABASE_URL}...")
    with engine.connect() as conn:
        print("Checking if display_type column exists...")
        res = conn.execute(text("SHOW COLUMNS FROM questions LIKE 'display_type';"))
        exists = res.fetchone()
        
        if not exists:
            print("Adding display_type column...")
            conn.execute(text("ALTER TABLE questions ADD COLUMN display_type ENUM('click', 'select') DEFAULT 'click';"))
            conn.commit()
            print("Successfully added column 'display_type'.")
        else:
            print("Column 'display_type' already exists.")

if __name__ == '__main__':
    try:
        run_migration()
    except Exception as e:
        print(f"Migration failed: {e}")
