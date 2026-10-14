from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    company_name = Column(String, default="My Company")
    company_email = Column(String, default="")
    payment_terms = Column(String, default="Due on Receipt")
    customer_name = Column(String, default="")
    customer_email = Column(String, default="")
    issue_date = Column(String, default="")
    due_date = Column(String, default="")
    tax_rate = Column(Float, default=0.0)
    subtotal = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    notes = Column(Text, default="")
    status = Column(String, default="PAID")  # PAID, PENDING, DRAFT
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("LineItem", back_populates="invoice", cascade="all, delete-orphan")


class LineItem(Base):
    __tablename__ = "line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    description = Column(String, nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    amount = Column(Float, default=0.0)

    invoice = relationship("Invoice", back_populates="items")
