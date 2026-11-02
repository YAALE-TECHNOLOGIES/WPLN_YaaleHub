from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import timedelta
from jose import JWTError, jwt

from ..database import get_db
from ..models.models import User, Role
from ..core.auth import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    create_refresh_token,
    decode_access_token
)
from ..schemas import Token, UserCreate, User as UserSchema

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=UserSchema)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    normalized_email = user_data.email.strip().lower()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    user = User(
        fullname=user_data.fullname,
        email=normalized_email,
        password_hash=hashed_password,
        role_id=user_data.role_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        email = form_data.username.strip().lower()
        print(f"Login attempt for: '{email}'")
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"User found for '{email}'. Verifying password...")
            is_valid = verify_password(form_data.password, user.password_hash)
            print(f"Password valid: {is_valid}")
        else:
            print(f"No user found with email: '{email}'")
        
        if not user or not verify_password(form_data.password, user.password_hash):
            print("Login failed: Invalid credentials")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_role = user.role.name if user.role else "CANDIDATE"
        access_token = create_access_token(
            data={"sub": user.email, "role": user_role}
        )
        refresh_token = create_refresh_token(
            data={"sub": user.email}
        )
        return {
            "access_token": access_token, 
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login Database Error: {str(e)}"
        )

@router.post("/refresh", response_model=Token)
def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(refresh_token)
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        if email is None or token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    
    new_access_token = create_access_token(
        data={"sub": user.email, "role": user.role.name}
    )
    # Optional: Rotate refresh token
    new_refresh_token = create_refresh_token(
        data={"sub": user.email}
    )
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserSchema)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
