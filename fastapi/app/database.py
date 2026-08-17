import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.schema import SCHEMA_STATEMENTS

DATABASE_URL = os.getenv("FASTAPI_DATABASE_URL", "postgresql+asyncpg://peblo:peblo@postgres:5432/peblo_tv_fastapi")
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def ensure_schema() -> None:
    """Create the required schema on first Docker start without external migration files."""
    async with engine.begin() as connection:
        for statement in SCHEMA_STATEMENTS:
            await connection.execute(text(statement))


async def get_session():
    async with SessionLocal() as session:
        yield session
