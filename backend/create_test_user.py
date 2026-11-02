import sys
import os
sys.path.append(os.getcwd())

from app.database import engine, get_db
from app.models.models import User, Role, RoleNames
from app.core.auth import get_password_hash

def create_candidate():
    db = next(get_db())
    role = db.query(Role).filter(Role.name == RoleNames.CANDIDATE).first()
    if not role:
        db.add(Role(name=RoleNames.CANDIDATE))
        db.commit()
        role = db.query(Role).filter(Role.name == RoleNames.CANDIDATE).first()
    
    user = db.query(User).filter(User.email == "user@wpln.com").first()
    if not user:
        db.add(User(
            fullname="Candidate User",
            email="user@wpln.com",
            password_hash=get_password_hash("user123"),
            role_id=role.id
        ))
        db.commit()
        print("Candidate user created: user@wpln.com / user123")
    else:
        print("Candidate user already exists")

if __name__ == "__main__":
    create_candidate()
