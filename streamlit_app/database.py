import os
import psycopg2
import pandas as pd
import bcrypt
from dotenv import load_dotenv
from datetime import date

# Load connection string from .env
load_dotenv()

DB_URL = os.getenv("DATABASE_URL")

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_pro BOOLEAN DEFAULT FALSE
        )
    """)
    # Migration for existing users table
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE;")
    conn.commit()
    cursor.close()
    conn.close()

def is_pro_user(username):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_pro FROM users WHERE username = %s", (username,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row[0] if (row and row[0] is not None) else False

def create_user(username, password):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)", (username, hashed))
        conn.commit()
        return True
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

def authenticate_user(username, password):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE username = %s", (username,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if row:
        return bcrypt.checkpw(password.encode('utf-8'), row[0].encode('utf-8'))
    return False

def migrate_guest_data(guest_id, new_username):
    """Transfer transient guest inventory/sales data to newly created permanent account."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE inventory SET user_id = %s WHERE user_id = %s", (new_username, guest_id))
    cursor.execute("UPDATE sales SET user_id = %s WHERE user_id = %s", (new_username, guest_id))
    conn.commit()
    cursor.close()
    conn.close()

def get_connection():
    return psycopg2.connect(DB_URL)

def get_inventory_df(user_id):
    """Retrieve all inventory belonging to this user as a Pandas DataFrame."""
    conn = get_connection()
    query = """
        SELECT id, item_name as "Item Name", brand as "Brand", 
               size as "Size", condition as "Condition", 
               purchase_price as "Purchase Price", status as "Status", 
               date_acquired as "Date Acquired" 
        FROM inventory 
        WHERE user_id = %s 
        ORDER BY created_at DESC
    """
    df = pd.read_sql(query, conn, params=(user_id,))
    conn.close()
    return df

def get_sales_df(user_id):
    """Retrieve all sales belonging to this user as a Pandas DataFrame."""
    conn = get_connection()
    query = """
        SELECT s.id, i.item_name as "Item Name", i.brand as "Brand", 
               s.sale_price as "Sale Price", s.platform as "Platform", 
               s.platform_fee as "Platform Fee", s.shipping_cost as "Shipping Cost", 
               s.net_profit as "Net Profit", s.date_sold as "Date Sold"
        FROM sales s
        JOIN inventory i ON s.inventory_id = i.id
        WHERE s.user_id = %s
        ORDER BY s.date_sold DESC, s.created_at DESC
    """
    df = pd.read_sql(query, conn, params=(user_id,))
    conn.close()
    return df

def add_item(user_id, name, brand, size, condition, purchase_price, date_acquired):
    """Insert a new item into the inventory table."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO inventory 
           (user_id, item_name, brand, size, condition, purchase_price, date_acquired) 
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (user_id, name, brand, size, condition, purchase_price, date_acquired)
    )
    conn.commit()
    cursor.close()
    conn.close()

def calculate_fee(platform, sale_price):
    """Calculate the exact platform fee based on our business logic engine."""
    sp = float(sale_price)
    if platform == 'StockX':
        # 9% transaction fee + 3% payment proc
        return round(sp * 0.09 + sp * 0.03, 2)
    elif platform == 'GOAT / Alias':
        # 9.5% commission + $5 base seller fee + 2.9% cash out fee
        return round((sp * 0.095 + 5.0) + (sp * 0.029), 2)
    elif platform == 'eBay (Sneakers >$150)':
        # 8% total fee for sneakers over $150 (no payment fee)
        return round(sp * 0.08, 2)
    elif platform == 'eBay (Standard)':
        # 13.25% + $0.30 standard fee
        return round(sp * 0.1325 + 0.30, 2)
    elif platform == 'Grailed':
        # 9% commission + 3.49% + $0.49 PayPal payment processing
        return round(sp * 0.09 + (sp * 0.0349 + 0.49), 2)
    elif platform == 'Poshmark':
        # 20% flat fee (>=$15), $2.95 flat (<$15)
        if sp >= 15:
            return round(sp * 0.20, 2)
        else:
            return 2.95
    elif platform == 'Depop':
        # 10% selling fee + 2.9% + $0.30 payment processing
        return round(sp * 0.10 + sp * 0.029 + 0.30, 2)
    elif platform == 'Flight Club':
        # 9.5% commission + $5 seller fee (Standard)
        return round(sp * 0.095 + 5.0, 2)
    elif platform == 'Stadium Goods':
        # 20% commission fee
        return round(sp * 0.20, 2)
    elif platform in ['Mercari', 'Vinted', 'Local/Cash (No Fee)']:
        # Currently 0% seller fees
        return 0.0
    return 0.0

def mark_as_sold(user_id, inventory_id, platform, sale_price, shipping_cost):
    """Calculate fees, record the sale, and update the inventory status atomically."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Fetch the original purchase price
        cursor.execute("SELECT purchase_price, status FROM inventory WHERE id = %s AND user_id = %s", (inventory_id, user_id))
        row = cursor.fetchone()
        if not row:
            raise Exception("Item not found. It may belong to another user.")
        purchase_price, status = row
        
        if status == 'Sold':
            raise Exception("This item has already been marked as sold.")
        
        purchase_price = float(purchase_price)
        sale_price = float(sale_price)
        shipping_cost = float(shipping_cost)
        
        # Fee Engine
        fee = calculate_fee(platform, sale_price)
        net_profit = round(sale_price - purchase_price - fee - shipping_cost, 2)
        date_sold = date.today().isoformat()
        
        # Insert Sale
        cursor.execute(
            """INSERT INTO sales 
               (user_id, inventory_id, sale_price, platform, platform_fee, shipping_cost, net_profit, date_sold) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (user_id, inventory_id, sale_price, platform, fee, shipping_cost, net_profit, date_sold)
        )
        
        # Update Inventory
        cursor.execute("UPDATE inventory SET status = 'Sold' WHERE id = %s", (inventory_id,))
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
