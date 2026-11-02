import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add the current directory to path so we can import app modules if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+mysqlconnector://root@localhost/wpln_assessment")

def run_migration():
    print(f"Connecting to database...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        # Check if column already exists to avoid errors
        print("Checking if 'education' column exists in 'users' table...")
        check_query = text("SHOW COLUMNS FROM users LIKE 'education'")
        result = connection.execute(check_query).fetchone()
        
        if result:
            print("Column 'education' already exists. No changes needed.")
            return

        print("Attempting to add 'education' column...")
        try:
            # Using ALGORITHM=INPLACE and LOCK=NONE to prevent hanging on production MySQL
            # We also set a timeout for the session to avoid indefinite hanging
            connection.execute(text("SET SESSION lock_wait_timeout = 60"))
            
            alter_query = text("""
                ALTER TABLE users 
                ADD COLUMN education VARCHAR(100) NULL,
                ALGORITHM=INPLACE, 
                LOCK=NONE
            """)
            
            connection.execute(alter_query)
            connection.commit()
            print("Successfully added 'education' column to 'users' table.")
            
        except Exception as e:
            print(f"Failed with Online DDL (INPLACE/NONE). Error: {e}")
            print("Falling back to standard ALTER TABLE...")
            try:
                # Fallback to standard alter if the specific engine/version doesn't support INPLACE
                connection.execute(text("ALTER TABLE users ADD COLUMN education VARCHAR(100) NULL"))
                connection.commit()
                print("Successfully added 'education' column using standard ALTER.")
            except Exception as e2:
                print(f"Migration failed completely. Error: {e2}")

if __name__ == "__main__":
    run_migration()
