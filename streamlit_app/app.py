import streamlit as st
import pandas as pd
from datetime import date
import database

# Configure the Streamlit page layout
st.set_page_config(page_title="Inventory Optimizer", page_icon="📦", layout="wide")

st.markdown("""
<style>
    /* Metric Cards Glassmorphism */
    [data-testid="stMetricValue"] {
        font-size: 2.2rem !important;
        font-weight: 800 !important;
        background: -webkit-linear-gradient(45deg, #6366f1, #a855f7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    [data-testid="stMetric"] {
        background: rgba(30, 31, 46, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
    }
    
    /* Premium Dataframes */
    [data-testid="stDataFrame"] {
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    /* Glow Hover Buttons */
    .stButton>button {
        border-radius: 8px !important;
        font-weight: 600 !important;
        transition: all 0.2s ease !important;
        border: 1px solid rgba(99, 102, 241, 0.3) !important;
    }
    .stButton>button:hover {
        box-shadow: 0 0 15px rgba(99, 102, 241, 0.4) !important;
        transform: translateY(-1px) !important;
        border-color: #6366f1 !important;
    }
    
    /* Clean Top Header */
    header {visibility: hidden;}
    #MainMenu {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

st.title("📦 Inventory Optimizer")
st.markdown("Easily track your sneaker & streetwear inventory, calculate platform fees, and analyze true net profit.")

# ----------------------------------------------------------------------------
# Data Fetching
# ----------------------------------------------------------------------------
inv_df = database.get_inventory_df()
sales_df = database.get_sales_df()

active_inv = inv_df[inv_df["Status"] == "In Stock"]

# ----------------------------------------------------------------------------
# Metric Cards (Top Row)
# ----------------------------------------------------------------------------
total_active_value = active_inv["Purchase Price"].astype(float).sum() if not active_inv.empty else 0.0
total_sold = len(sales_df)

# 30-Day Profit Logic
thirty_day_profit = 0.0
if not sales_df.empty:
    sales_df['Date Sold'] = pd.to_datetime(sales_df['Date Sold'])
    thirty_days_ago = pd.Timestamp.today() - pd.Timedelta(days=30)
    recent_sales = sales_df[sales_df['Date Sold'] >= thirty_days_ago]
    thirty_day_profit = recent_sales["Net Profit"].astype(float).sum()
    
    # Format the dates back to string for clean display in the dataframe
    sales_df['Date Sold'] = sales_df['Date Sold'].dt.strftime('%Y-%m-%d')

col1, col2, col3 = st.columns(3)
col1.metric("Total Active Inventory Value", f"${total_active_value:,.2f}")
col2.metric("30-Day Net Profit", f"${thirty_day_profit:,.2f}")
col3.metric("Total Items Sold", f"{total_sold}")

st.markdown("---")

# ----------------------------------------------------------------------------
# Sidebar: Add New Item Form
# ----------------------------------------------------------------------------
st.sidebar.header("➕ Add New Item")
with st.sidebar.form("add_item_form"):
    name = st.text_input("Item Name (e.g., Jordan 4 White Cement)")
    brand = st.selectbox("Brand", ["Nike", "New Balance", "Adidas", "Amiri", "Supreme", "Chrome Hearts", "Other"])
    size = st.text_input("Size (e.g., 10, M)")
    condition = st.selectbox("Condition", ["New", "Used"])
    purchase_price = st.number_input("Purchase Price ($)", min_value=0.0, format="%.2f", step=10.0)
    date_acquired = st.date_input("Date Acquired", date.today())
    
    if st.form_submit_button("Add to Inventory"):
        if name and size:
            database.add_item(name, brand, size, condition, purchase_price, date_acquired.isoformat())
            st.toast(f"{name} added successfully!", icon="✅")
            st.rerun()
        else:
            st.sidebar.error("Please fill out Name and Size.")

# ----------------------------------------------------------------------------
# Main Content: Tabs
# ----------------------------------------------------------------------------
tab1, tab2 = st.tabs(["📋 Active Inventory", "💰 Completed Sales"])

with tab1:
    st.subheader("Active Inventory")
    st.dataframe(active_inv, use_container_width=True, hide_index=True)
    
    if not active_inv.empty:
        st.markdown("### Mark Item as Sold")
        with st.form("mark_sold_form"):
            colA, colB = st.columns(2)
            with colA:
                # Format a clean dropdown list (e.g., "15 - Jordan 4 (10)")
                item_options = active_inv.apply(lambda row: f"{row['id']} - {row['Item Name']} (Size {row['Size']})", axis=1).tolist()
                selected_item = st.selectbox("Select Item to Sell", item_options)
                platform = st.selectbox("Platform Sold On", ["StockX", "eBay", "Poshmark", "Depop"])
            with colB:
                sale_price = st.number_input("Final Gross Sale Price ($)", min_value=0.0, format="%.2f", step=10.0)
                shipping_cost = st.number_input("Shipping Label Cost ($)", min_value=0.0, format="%.2f", step=1.0)
            
            if st.form_submit_button("Submit Sale"):
                if sale_price > 0:
                    item_id = int(selected_item.split(" - ")[0])
                    try:
                        database.mark_as_sold(item_id, platform, sale_price, shipping_cost)
                        st.balloons()
                        st.toast(f"Sale recorded on {platform}!", icon="🎉")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error recording sale: {e}")
                else:
                    st.error("Sale price must be greater than $0.")
    else:
        st.info("Your active inventory is empty. Add your first item using the sidebar on the left!")

with tab2:
    st.subheader("Completed Sales History")
    if not sales_df.empty:
        # Reorder columns slightly for better readibility
        display_sales = sales_df[["Item Name", "Brand", "Platform", "Sale Price", "Platform Fee", "Shipping Cost", "Net Profit", "Date Sold"]]
        
        # Color code profit (Green for positive, Red for negative) in the dataframe 
        def color_profit(val):
            color = '#22c55e' if float(val) > 0 else '#ef4444' if float(val) < 0 else 'white'
            return f'color: {color}; font-weight: bold'
            
        st.dataframe(
            display_sales.style.map(color_profit, subset=['Net Profit']), 
            use_container_width=True, 
            hide_index=True
        )
    else:
        st.info("No completed sales yet. Sell an item from the Active Inventory tab!")
