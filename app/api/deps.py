from motor.motor_asyncio import AsyncIOMotorDatabase
from db.mongodb import db
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.config import settings
from app.db.repositories.users import UserRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_user_repository() -> UserRepository:
    return UserRepository(db.db)

async def get_database() -> AsyncIOMotorDatabase:
    return db.db 

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    user_repo: UserRepository = Depends(get_user_repository)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user 