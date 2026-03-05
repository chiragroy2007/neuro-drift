import sqlite3

def check_db():
    try:
        conn = sqlite3.connect('backend/biodrift.db')
        cursor = conn.cursor()
        
        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print("Tables in DB:", tables)
        
        if tables:
            for t in tables:
                table_name = t[0]
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                print(f"Table {table_name} row count: {count}")
                
        conn.close()
    except Exception as e:
        print("DB Error:", e)

check_db()
