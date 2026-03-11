import os
import psycopg2
import pandas as pd
from dotenv import load_dotenv
from datetime import date

# Load connection string from .env
load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
# Bypass Clerk Auth: Use a default unified user ID for the Python prototype
USER_ID = "streamlit_unified_user"

def get_connection():
    return psycopg2.connect(DB_URL)

def get_inventory_df():
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
    df = pd.read_sql(query, conn, params=(USER_ID,))
    conn.close()
    return df

def get_sales_df():
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
    df = pd.read_sql(query, conn, params=(USER_ID,))
    conn.close()
    return df

def add_item(name, brand, size, condition, purchase_price, date_acquired):
    """Insert a new item into the inventory table."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO inventory 
           (user_id, item_name, brand, size, condition, purchase_price, date_acquired) 
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (USER_ID, name, brand, size, condition, purchase_price, date_acquired)
    )
    conn.commit()
    cursor.close()
    conn.close()

def calculate_fee(platform, sale_price):
    """Calculate the exact platform fee based on our business logic engine."""
    sp = float(sale_price)
    if platform == 'StockX':
        return round(sp * 0.09 + sp * 0.03, 2)
    elif platform == 'eBay':
        return round(sp * 0.1325 + 0.30, 2)
    elif platform == 'Poshmark':
        return round(sp * 0.20, 2)
    elif platform == 'Depop':
        return round(sp * 0.10 + sp * 0.029 + 0.30, 2)
    return 0.0

def mark_as_sold(inventory_id, platform, sale_price, shipping_cost):
    """Calculate fees, record the sale, and update the inventory status atomically."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Fetch the original purchase price
        cursor.execute("SELECT purchase_price, status FROM inventory WHERE id = %s AND user_id = %s", (inventory_id, USER_ID))
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
            (USER_ID, inventory_id, sale_price, platform, fee, shipping_cost, net_profit, date_sold)
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
