"""
BelekBox.kg - Магазин подарочных боксов
Главный файл приложения FastAPI
"""

import os
import json
import uuid
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse

# ===== КОНФИГУРАЦИЯ =====

# Загружаем переменные окружения из .env файла
load_dotenv()

# Создаем необходимые папки если их нет
Path("uploads/products").mkdir(parents=True, exist_ok=True)
Path("static/css").mkdir(parents=True, exist_ok=True)
Path("static/js").mkdir(parents=True, exist_ok=True)
Path("static/images").mkdir(parents=True, exist_ok=True)
Path("templates").mkdir(parents=True, exist_ok=True)

# Настройки из .env файла
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
WHATSAPP_ORDER_NUMBER = os.getenv(
    "WHATSAPP_ORDER_NUMBER", "996501053515"
)  # Для заказов
CONTACT_NUMBERS = os.getenv("CONTACT_NUMBERS", "+996 500 555 626")  # Для отображения

# Базовый путь
BASE_DIR = Path(__file__).parent

# ===== ИНИЦИАЛИЗАЦИЯ FASTAPI =====

app = FastAPI(
    title="BelekBox.kg",
    description="Магазин подарочных боксов с доставкой по Кыргызстану",
    version="1.0.0",
    docs_url="/docs",  # Включить документацию API
    redoc_url="/redoc",  # Альтернативная документация
)

# Настройка CORS (разрешаем доступ с любых доменов)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== СТАТИЧЕСКИЕ ФАЙЛЫ =====

# Подключаем статические файлы
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/static", StaticFiles(directory="static"), name="static")

# ===== БАЗА ДАННЫХ =====

# SQLite база данных
SQLALCHEMY_DATABASE_URL = "sqlite:///./database.db"

# Создаем движок базы данных
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}  # Для SQLite
)

# Создаем фабрику сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()

# ===== МОДЕЛИ БАЗЫ ДАННЫХ =====


class Product(Base):
    """
    Модель товара (подарочного бокса)
    Хранит информацию о товарах магазина
    """

    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # Название товара
    description = Column(Text, nullable=False)  # Описание
    price = Column(Integer, nullable=False)  # Цена в сомах
    image_url = Column(String)  # URL изображения товара
    is_available = Column(Boolean, default=True)  # Доступен для заказа
    sort_order = Column(Integer, default=0)  # Порядок сортировки
    created_at = Column(DateTime, default=datetime.now)  # Дата создания

    def __repr__(self):
        return f"<Product(id={self.id}, name='{self.name}', price={self.price})>"


class Order(Base):
    """
    Модель заказа
    Хранит информацию о заказах покупателей
    """

    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(
        String, unique=True, nullable=False
    )  # Уникальный номер заказа
    items_json = Column(Text, nullable=False)  # Товары в JSON формате
    client_phone = Column(String)  # Телефон клиента
    client_comment = Column(String)  # Комментарий к заказу
    total_amount = Column(Integer, nullable=False)  # Общая сумма заказа
    created_at = Column(DateTime, default=datetime.now)  # Дата создания заказа

    def __repr__(self):
        return f"<Order(id={self.id}, order_number='{self.order_number}', total={self.total_amount})>"


# Создаем таблицы в базе данных (если их нет)
Base.metadata.create_all(bind=engine)

# ===== ЗАВИСИМОСТИ =====


def get_db():
    """
    Зависимость для получения сессии базы данных.
    Гарантирует закрытие сессии после использования.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ===== УТИЛИТЫ =====


def generate_order_number() -> str:
    """
    Генерирует уникальный номер заказа.
    Формат: BB-YYYYMMDD-XXXXXX (где XXXXXX - случайная строка)
    """
    date_str = datetime.now().strftime("%Y%m%d")
    random_part = uuid.uuid4().hex[:6].upper()
    return f"BB-{date_str}-{random_part}"


def create_whatsapp_message(
    order_number: str,
    items: list,
    total_amount: int,
    client_phone: Optional[str],
    client_comment: Optional[str],
) -> str:
    """
    Создает сообщение для WhatsApp с информацией о заказе.
    """
    import urllib.parse

    message = "Здравствуйте! Хочу заказать:\n\n"
    message += f"Заказ #{order_number}\n\n"
    message += "Товары:\n"

    for i, item in enumerate(items, 1):
        message += f"{i}. {item['name']} - {item['quantity']} шт. × {item['price']} сом = {item['quantity'] * item['price']} сом\n"

    message += f"\nИтого: {total_amount} сом\n\n"
    message += f"Телефон: {client_phone or 'Не указан'}\n"
    message += f"Комментарий: {client_comment or 'Нет комментария'}\n\n"
    message += "Доставка по всему Кыргызстану. Самовывоз в Бишкеке."

    return urllib.parse.quote(message)


def verify_admin(request: Request) -> bool:
    """
    Проверяет авторизацию администратора.
    Используется как зависимость в защищенных эндпоинтах.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Не авторизован")

    token = auth_header.split(" ")[1]
    if token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Неверный пароль")

    return True


# ===== МАРШРУТЫ ГЛАВНОЙ СТРАНИЦЫ =====


@app.get("/", response_class=HTMLResponse)
async def read_root():
    """
    Главная страница магазина.
    Возвращает HTML шаблон главной страницы.
    """
    try:
        with open("templates/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>BelekBox.kg</h1><p>Магазин подарочных боксов</p>"
        )


@app.get("/admin", response_class=HTMLResponse)
async def admin_panel():
    """
    Страница админ панели.
    Доступна только авторизованным пользователям.
    """
    try:
        with open("templates/admin.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Админ панель</h1><p>Файл admin.html не найден</p>"
        )


# ===== API ДЛЯ КЛИЕНТОВ =====


@app.get("/api/products")
async def get_products(db: Session = Depends(get_db)):
    """
    Получение списка доступных товаров.
    Возвращает только товары с is_available=True.
    """
    try:
        products = (
            db.query(Product)
            .filter(Product.is_available == True)
            .order_by(Product.sort_order, Product.id)
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
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка загрузки товаров: {str(e)}"
        )


@app.post("/api/orders")
async def create_order(
    items: str = Form(...),
    total_amount: int = Form(...),
    client_phone: Optional[str] = Form(None),
    client_comment: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Создание нового заказа.
    Принимает товары в корзине и контактные данные клиента.
    """
    try:
        # Парсим JSON с товарами
        items_data = json.loads(items)

        if not items_data:
            return {"success": False, "error": "Корзина пуста"}

        # Генерируем номер заказа
        order_number = generate_order_number()

        # Создаем заказ
        order = Order(
            order_number=order_number,
            items_json=items,
            client_phone=client_phone,
            client_comment=client_comment,
            total_amount=total_amount,
        )

        # Сохраняем в БД
        db.add(order)
        db.commit()
        db.refresh(order)

        # Создаем ссылку для WhatsApp
        whatsapp_url = (
            f"https://wa.me/{WHATSAPP_ORDER_NUMBER}?text="
            + create_whatsapp_message(
                order_number, items_data, total_amount, client_phone, client_comment
            )
        )

        return {
            "success": True,
            "order_number": order_number,
            "whatsapp_url": whatsapp_url,
        }

    except json.JSONDecodeError:
        return {"success": False, "error": "Неверный формат товаров"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/health")
async def health_check():
    """
    Проверка здоровья сервиса.
    Используется для мониторинга.
    """
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "BelekBox.kg",
        "version": "1.0.0",
    }


# ===== API ДЛЯ АДМИНИСТРАТОРОВ =====


class LoginRequest(BaseModel):
    """Модель запроса для входа в админку"""

    password: str


@app.post("/api/admin/login")
async def admin_login(request: LoginRequest):
    """
    Авторизация администратора.
    Проверяет пароль и возвращает токен.
    """
    if request.password == ADMIN_PASSWORD:
        return {"success": True, "token": ADMIN_PASSWORD}
    return {"success": False, "error": "Неверный пароль"}


@app.get("/api/admin/products")
async def admin_get_products(
    verified: bool = Depends(verify_admin), db: Session = Depends(get_db)
):
    """
    Получение всех товаров для админки.
    Возвращает полную информацию о всех товарах.
    """
    try:
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
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка загрузки товаров: {str(e)}"
        )


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
    """
    Создание нового товара.
    Поддерживает загрузку изображения товара.
    """
    try:
        image_url = None

        # Обрабатываем загруженное изображение
        if image and image.filename:
            # Создаем уникальное имя файла
            file_extension = os.path.splitext(image.filename)[1]
            filename = f"{uuid.uuid4().hex}{file_extension}"
            file_path = f"uploads/products/{filename}"

            # Сохраняем файл
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)

            image_url = f"/uploads/products/{filename}"

        # Создаем товар
        product = Product(
            name=name,
            description=description,
            price=price,
            image_url=image_url,
            is_available=is_available,
            sort_order=sort_order,
        )

        # Сохраняем в БД
        db.add(product)
        db.commit()
        db.refresh(product)

        return {"success": True, "product_id": product.id}

    except Exception as e:
        return {"success": False, "error": str(e)}


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
    """
    Обновление существующего товара.
    Поддерживает обновление изображения.
    """
    try:
        # Находим товар
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Товар не найден")

        # Обновляем поля если они переданы
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
        if image and image.filename:
            # Удаляем старое изображение если было
            if product.image_url:
                old_path = product.image_url.replace("/uploads/", "uploads/")
                if os.path.exists(old_path):
                    os.remove(old_path)

            # Сохраняем новое изображение
            file_extension = os.path.splitext(image.filename)[1]
            filename = f"{uuid.uuid4().hex}{file_extension}"
            file_path = f"uploads/products/{filename}"

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)

            product.image_url = f"/uploads/products/{filename}"

        # Сохраняем изменения
        db.commit()
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.delete("/api/admin/products/{product_id}")
async def admin_delete_product(
    product_id: int,
    verified: bool = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Удаление товара.
    Также удаляет связанное изображение если оно есть.
    """
    try:
        # Находим товар
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Товар не найден")

        # Удаляем изображение если есть
        if product.image_url:
            image_path = product.image_url.replace("/uploads/", "uploads/")
            if os.path.exists(image_path):
                os.remove(image_path)

        # Удаляем товар из БД
        db.delete(product)
        db.commit()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/admin/orders")
async def admin_get_orders(
    verified: bool = Depends(verify_admin), db: Session = Depends(get_db)
):
    """
    Получение всех заказов для админки.
    """
    try:
        orders = db.query(Order).order_by(Order.created_at.desc()).all()

        return [
            {
                "id": o.id,
                "order_number": o.order_number,
                "items": json.loads(o.items_json),
                "client_phone": o.client_phone,
                "client_comment": o.client_comment,
                "total_amount": o.total_amount,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ]
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка загрузки заказов: {str(e)}"
        )


@app.post("/api/admin/hide-all")
async def admin_hide_all(
    verified: bool = Depends(verify_admin), db: Session = Depends(get_db)
):
    """
    Скрывает все товары (для смены сезона).
    """
    try:
        db.query(Product).update({Product.is_available: False})
        db.commit()
        return {"success": True, "hidden": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/admin/show-all")
async def admin_show_all(
    verified: bool = Depends(verify_admin), db: Session = Depends(get_db)
):
    """
    Показывает все товары.
    """
    try:
        db.query(Product).update({Product.is_available: True})
        db.commit()
        return {"success": True, "shown": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ===== ДОПОЛНИТЕЛЬНЫЙ МАРШРУТ ДЛЯ FAVICON =====


@app.get("/favicon.ico")
async def favicon():
    """
    Отдаем favicon.
    """
    favicon_path = BASE_DIR / "static" / "images" / "favicon.png"
    if favicon_path.exists():
        return FileResponse(favicon_path)
    raise HTTPException(status_code=404, detail="Favicon not found")


# ===== ТОЧКА ВХОДА =====

if __name__ == "__main__":
    import uvicorn

    # Запуск сервера для разработки
    uvicorn.run(
        app,
        host="0.0.0.0",  # Доступ с любых IP
        port=8000,  # Порт по умолчанию
        reload=True,  # Автоматическая перезагрузка при изменениях
    )
