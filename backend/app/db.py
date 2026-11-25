from collections.abc import AsyncIterator
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings

engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
Session = async_sessionmaker(engine, expire_on_commit=False)


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # e.g. C-1042
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String, index=True)
    address: Mapped[str] = mapped_column(String, index=True)
    city: Mapped[str] = mapped_column(String)
    language: Mapped[str] = mapped_column(String, default="hi-IN")


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # e.g. O-50001
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    item_name: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)  # occasion | everyday
    value_paise: Mapped[int] = mapped_column(Integer)
    payment: Mapped[str] = mapped_column(String)  # prepaid | cod
    ordered_at: Mapped[datetime] = mapped_column(DateTime)
    returned: Mapped[bool] = mapped_column(Boolean, default=False)
    # delivery proof (mocked courier data, seeded)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    gps_distance_m: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Claim(Base):
    __tablename__ = "claims"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    type: Mapped[str] = mapped_column(String)  # return | not_delivered
    reason_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="awaiting_customer")  # awaiting_customer|scored|decided
    score: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[str] = mapped_column(String, default="low")
    fired: Mapped[list] = mapped_column(JSON, default=list)
    answers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    question_style: Mapped[str | None] = mapped_column(String, nullable=True)
    decision: Mapped[str | None] = mapped_column(String, nullable=True)  # approve | reject
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with Session() as s:
        yield s
