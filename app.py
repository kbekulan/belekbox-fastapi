import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import json
import uuid
from dotenv import load_dotenv
from typing import Optional
import shutil

# Загружаем переменные окружения
load_dotenv()

# Создаем папки если их нет
Path("uploads/products").mkdir(parents=True, exist_ok=True)

# Настройки
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
WHATSAPP_NUMBER = os.getenv("WHATSAPP_NUMBER", "996500555626")
BASE_DIR = Path(__file__).parent

# Инициализация FastAPI
app = FastAPI(title="BelekBox.kg", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статические файлы
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# База данных
SQLALCHEMY_DATABASE_URL = "sqlite:///./database.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Модели
class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Integer, nullable=False)
    image_url = Column(String)
    is_available = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, nullable=False)
    items_json = Column(Text, nullable=False)
    client_name = Column(String)
    client_comment = Column(String)
    total_amount = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


# Создаем таблицы
Base.metadata.create_all(bind=engine)


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Генерация номера заказа
def generate_order_number():
    date_str = datetime.now().strftime("%Y%m%d")
    return f"BB-{date_str}-{uuid.uuid4().hex[:6].upper()}"


# Главная страница
@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Главная страница</h1><p>Скоро здесь будет сайт!</p>"
        )


# Админ панель
@app.get("/admin", response_class=HTMLResponse)
async def admin_panel():
    try:
        with open("admin.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Админ панель</h1><p>Скоро здесь будет админка!</p>"
        )


# API для продуктов (публичный)
@app.get("/api/products")
async def get_products(db: Session = Depends(get_db)):
    products = (
        db.query(Product)
        .filter(Product.is_available == True)
        .order_by(Product.sort_order)
        .all()
    )
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "image_url": p.image_url,
            "is_available": p.is_available,
        }
        for p in products
    ]


# API для создания заказа
@app.post("/api/orders")
async def create_order(
    items: str = Form(...),
    total_amount: int = Form(...),
    client_name: Optional[str] = Form(None),
    client_comment: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    try:
        # Проверяем валидность items
        items_data = json.loads(items)

        order_number = generate_order_number()
        order = Order(
            order_number=order_number,
            items_json=items,
            client_name=client_name,
            client_comment=client_comment,
            total_amount=total_amount,
        )

        db.add(order)
        db.commit()
        db.refresh(order)

        return {
            "success": True,
            "order_number": order_number,
            "whatsapp_url": f"https://wa.me/{WHATSAPP_NUMBER}?text="
            + create_whatsapp_message(
                order_number, items_data, total_amount, client_name, client_comment
            ),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# Функция для создания сообщения WhatsApp
def create_whatsapp_message(
    order_number, items, total_amount, client_name, client_comment
):
    message = "Здравствуйте! Хочу заказать:\n\n"
    message += f"Заказ #{order_number}\n\n"
    message += "Товары:\n"

    for i, item in enumerate(items, 1):
        message += f"{i}. {item['name']} - {item['quantity']} шт. × {item['price']} сом = {item['quantity'] * item['price']} сом\n"

    message += f"\nИтого: {total_amount} сом\n\n"
    message += f"Имя: {client_name or 'Не указано'}\n"
    message += f"Комментарий: {client_comment or 'Нет комментария'}\n\n"
    message += "Самовывоз в Бишкеке."

    # URL encode
    import urllib.parse

    return urllib.parse.quote(message)


# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
