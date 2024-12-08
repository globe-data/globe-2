from datetime import datetime
from enum import StrEnum
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, SecretStr
class UserRole(StrEnum):
    """Enumeration of possible user roles."""
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"

class UserStatus(StrEnum):
    """Enumeration of possible user account statuses."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"

class UserBase(BaseModel):
    """Base model for user data.
    
    Attributes:
        email: User's email address
        username: User's chosen username
        full_name: User's full name
        role: User's role/permission level
        status: Current account status
    """
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, max_length=100)
    role: UserRole = Field(default=UserRole.USER)
    status: UserStatus = Field(default=UserStatus.PENDING)

class UserCreate(UserBase):
    """Model for creating a new user, including password."""
    password: SecretStr = Field(..., min_length=8)

class UserUpdate(BaseModel):
    """Model for updating user information."""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, max_length=100)
    password: Optional[SecretStr] = Field(None, min_length=8)
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None

class UserInDB(UserBase):
    """Model representing a user as stored in the database.
    
    Extends UserBase with database-specific fields.
    """
    globe_id: UUID
    hashed_password: str
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserResponse(UserBase):
    """Model for user data returned in API responses.
    
    Excludes sensitive information.
    """
    id: UUID
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True

class EmailVerification(BaseModel):
    """Model for email verification."""
    email: EmailStr
    verification_token: str
    expires_at: datetime

class UserSession(BaseModel):
    """Model for user session data."""
    session_id: UUID
    user_id: UUID
    created_at: datetime
    expires_at: datetime
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    is_active: bool = True

class Token(BaseModel):
    """Model for authentication tokens."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class LoginResponse(BaseModel):
    """Model for successful login response."""
    user: UserResponse
    token: Token

class PasswordResetRequest(BaseModel):
    """Model for password reset requests."""
    email: EmailStr

class PasswordReset(BaseModel):
    """Model for password reset execution."""
    token: str
    new_password: SecretStr = Field(..., min_length=8)

__all__ = [
    name for name, obj in globals().items() 
    if isinstance(obj, type) and issubclass(obj, BaseModel) and obj != BaseModel
]