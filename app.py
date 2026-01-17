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
from pydantic import BaseModel
import shutil
import urllib.parse

# Загружаем переменные окружения
load_dotenv()

# Создаем папки если их нет
Path("uploads/products").mkdir(parents=True, exist_ok=True)

# Настройки
# Настройки
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
WHATSAPP_ORDER_NUMBER = os.getenv(
    "WHATSAPP_ORDER_NUMBER", "996501053515"
)  # Для заказов
CONTACT_NUMBERS = os.getenv("CONTACT_NUMBERS", "+996 500 555 626")  # Для отображения
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
app.mount("/static", StaticFiles(directory="static"), name="static")
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
    client_phone = Column(String)  # Заменяем client_name на client_phone
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
    client_phone: Optional[str] = Form(None),  # Заменяем client_name на client_phone
    client_comment: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    try:
        items_data = json.loads(items)

        order_number = generate_order_number()
        order = Order(
            order_number=order_number,
            items_json=items,
            client_phone=client_phone,  # Заменяем client_name на client_phone
            client_comment=client_comment,
            total_amount=total_amount,
        )

        db.add(order)
        db.commit()
        db.refresh(order)

        return {
            "success": True,
            "order_number": order_number,
            "whatsapp_url": f"https://wa.me/{WHATSAPP_ORDER_NUMBER}?text="
            + create_whatsapp_message(
                order_number, items_data, total_amount, client_phone, client_comment
            ),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# Функция для создания сообщения WhatsApp
def create_whatsapp_message(
    order_number, items, total_amount, client_phone, client_comment
):
    message = "Здравствуйте! Хочу заказать:\n\n"
    message += f"Заказ #{order_number}\n\n"
    message += "Товары:\n"

    for i, item in enumerate(items, 1):
        message += f"{i}. {item['name']} - {item['quantity']} шт. × {item['price']} сом = {item['quantity'] * item['price']} сом\n"

    message += f"\nИтого: {total_amount} сом\n\n"
    message += f"Телефон: {client_phone or 'Не указан'}\n"
    message += f"Комментарий: {client_comment or 'Нет комментария'}\n\n"
    message += "Доставка по всему Кыргызстану. Самовывоз в Бишкеке."

    import urllib.parse

    return urllib.parse.quote(message)


# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ============================================
# АДМИНСКИЕ ЭНДПОИНТЫ
# ============================================


# Зависимость для проверки пароля админа
def verify_admin(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Не авторизован")

    token = auth_header.split(" ")[1]
    if token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Неверный пароль")

    return True


# Вход в админку
from pydantic import BaseModel


class LoginRequest(BaseModel):
    password: str


@app.post("/api/admin/login")
async def admin_login(request: LoginRequest):
    if request.password == ADMIN_PASSWORD:
        return {"success": True, "token": ADMIN_PASSWORD}
    return {"success": False, "error": "Неверный пароль"}


# Получение всех товаров (админ)
@app.get("/api/admin/products")
async def admin_get_products(
    verified: bool = Depends(verify_admin), db: Session = Depends(get_db)
):
    products = db.query(Product).order_by(Product.sort_order, Product.id).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "image_url": p.image_url,
            "is_available": p.is_available,
            "sort_order": p.sort_order,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in products
    ]


# Добавление товара
@app.post("/api/admin/products")
async def admin_create_product(
    name: str = Form(...),
    description: str = Form(...),
    price: int = Form(...),
    is_available: bool = Form(True),
    sort_order: int = Form(0),
    image: Optional[UploadFile] = File(None),
    verified: bool = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    try:
        image_url = None
        if image:
            # Создаем уникальное имя файла
            file_extension = os.path.splitext(image.filename)[1]
            filename = f"{uuid.uuid4().hex}{file_extension}"
            file_path = f"uploads/products/{filename}"

            # Сохраняем файл
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)

            image_url = f"/uploads/products/{filename}"

        product = Product(
            name=name,
            description=description,
            price=price,
            image_url=image_url,
            is_available=is_available,
            sort_order=sort_order,
        )

        db.add(product)
        db.commit()
        db.refresh(product)

        return {"success": True, "product_id": product.id}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Обновление товара
@app.put("/api/admin/products/{product_id}")
async def admin_update_product(
    product_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: Optional[int] = Form(None),
    is_available: Optional[bool] = Form(None),
    sort_order: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    verified: bool = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Товар не найден")

        # Обновляем поля
        if name is not None:
            product.name = name
        if description is not None:
            product.description = description
        if price is not None:
            product.price = price
        if is_available is not None:
            product.is_available = is_available
        if sort_order is not None:
            product.sort_order = sort_order

        # Обновляем изображение если нужно
        if image:
            # Удаляем старое изображение если было
            if product.image_url:
                old_path = product.image_url.replace("/uploads/", "uploads/")
                if os.path.exists(old_path):
                    os.remove(old_path)

            # Сохраняем новое
            file_extension = os.path.splitext(image.filename)[1]
            filename = f"{uuid.uuid4().hex}{file_extension}"
            file_path = f"uploads/products/{filename}"

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)

            product.image_url = f"/uploads/products/{filename}"

        db.commit()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Удаление товара
@app.delete("/api/admin/products/{product_id}")
async def admin_delete_product(
    product_id: int,
    verified: bool = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Товар не найден")

        # Удаляем изображение если есть
        if product.image_url:
            image_path = product.image_url.replace("/uploads/", "uploads/")
            if os.path.exists(image_path):
                os.remove(image_path)

        db.delete(product)
        db.commit()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Получение всех заказов
@app.get("/api/admin/orders")
async def admin_get_orders(
    verified: bool = Depends(verify_admin), db: Session = Depends(get_db)
):
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "items": json.loads(o.items_json),
            "client_phone": o.client_phone,  # Заменяем client_name на client_phone
            "client_comment": o.client_comment,
            "total_amount": o.total_amount,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in orders
    ]


# Скрыть все товары
@app.post("/api/admin/hide-all")
async def admin_hide_all(
    verified: bool = Depends(verify_admin), db: Session = Depends(get_db)
):
    try:
        db.query(Product).update({Product.is_available: False})
        db.commit()
        return {"success": True, "hidden": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Показать все товары
@app.post("/api/admin/show-all")
async def admin_show_all(
    verified: bool = Depends(verify_admin), db: Session = Depends(get_db)
):
    try:
        db.query(Product).update({Product.is_available: True})
        db.commit()
        return {"success": True, "shown": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
