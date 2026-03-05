from backend.database import SessionLocal
from backend.models import User

db = SessionLocal()
users = db.query(User).all()
print("Total users:", len(users))
for u in users:
    print(u.id, u.name)
db.close()
