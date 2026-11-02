
import os
import mysql.connector

# Manual credentials check from common local setup
try:
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="wpln_assessment"
    )
    cursor = conn.cursor()
    cursor.execute("DESCRIBE questions")
    cols = [c[0] for c in cursor.fetchall()]
    print("Current columns:", cols)
    
    if "audio_script" not in cols:
        print("Adding audio_script...")
        cursor.execute("ALTER TABLE questions ADD COLUMN audio_script TEXT NULL AFTER question_text")
        conn.commit()
        print("ADDED SUCCESS")
    else:
        print("ALREADY EXISTS")
    
    conn.close()
except Exception as e:
    print(f"FAILED: {e}")
