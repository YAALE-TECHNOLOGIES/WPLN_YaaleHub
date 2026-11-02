
import os
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

load_dotenv(dotenv_path='d:/WPLN/backend/.env')

DATABASE_URL = "mysql+mysqlconnector://root:root@localhost/wpln_assessment"
engine = create_engine(DATABASE_URL)

def migrate():
    try:
        inspector = inspect(engine)
        columns = [c['name'] for c in inspector.get_columns('questions')]
        
        if 'audio_script' not in columns:
            with engine.connect() as connection:
                print("Adding 'audio_script' column...")
                connection.execute(text("ALTER TABLE questions ADD COLUMN audio_script TEXT NULL AFTER question_text"))
                connection.commit()
                print("Migration successful.")
        else:
            print("Column 'audio_script' already exists.")
            
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
