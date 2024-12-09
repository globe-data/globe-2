from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from app.config import settings
from passlib.context import CryptContext
from app.db.repositories.users import UserRepository
from app.models import UserCreate, UserInDB


class AuthService:
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def create_access_token(self, user_id: str) -> str:
        """Creates a user access token using jwt for auth access to the Globe Data platform

        Args:
            user_id (str): UUID representing the user.

        Returns:
            str: JWT access token for authentication
        """
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        return jwt.encode(
            {"exp": expire, "sub": str(user_id)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

    async def authenticate_user(self, email: str, password: str) -> Optional[UserInDB]:
        user = await self.user_repository.get_by_email(email)
        if not user or not self.pwd_context.verify(password, user.hashed_password):
            return None
        return user

    async def register_user(self, user_create: UserCreate) -> UserInDB:
        # Check if user exists
        existing_user = await self.user_repository.get_by_email(user_create.email)
        if existing_user:
            raise ValueError("Email already registered")

        # Create new user
        hashed_password = self.pwd_context.hash(user_create.password)
        user_in_db = UserInDB(
            **user_create.model_dump(),
            hashed_password=hashed_password,
            created_at=datetime.utcnow()
        )
        user_id = await self.user_repository.create_user(user_in_db)
        return user_in_db
