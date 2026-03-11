import streamlit as st
import pandas as pd
from datetime import date
import uuid
import database

# Configure the Streamlit page layout
st.set_page_config(page_title="Inventory Optimizer", page_icon="📦", layout="wide", initial_sidebar_state="expanded")

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
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

st.logo("logo.png")

# Initialize database on startup
try:
    database.init_db()
except Exception as e:
    pass

# Session State Initialization
if "username" not in st.session_state:
    st.session_state.username = None

if "guest_id" not in st.session_state:
    st.session_state.guest_id = f"guest_{uuid.uuid4().hex[:8]}"

# Determine active user identity (Registered User OR Anonymous Guest)
user_id = st.session_state.username if st.session_state.username else st.session_state.guest_id

# ----------------------------------------------------------------------------
# Authentication Flow (Dialog)
# ----------------------------------------------------------------------------
@st.dialog("🔐 Sign In / Create Account")
def auth_dialog():
    tab1, tab2 = st.tabs(["Login", "Sign Up"])
    with tab1:
        login_user = st.text_input("Username")
        login_pass = st.text_input("Password", type="password")
        if st.button("Login", use_container_width=True):
            if database.authenticate_user(login_user, login_pass):
                st.session_state.username = login_user
                st.rerun()
            else:
                st.error("Invalid username or password.")
    with tab2:
        signup_user = st.text_input("New Username")
        signup_pass = st.text_input("New Password", type="password")
        if st.button("Sign Up & Save Data", use_container_width=True):
            if signup_user and signup_pass:
                if database.create_user(signup_user, signup_pass):
                    # Migrate guest data to new user so they don't lose their tracking!
                    database.migrate_guest_data(st.session_state.guest_id, signup_user)
                    st.session_state.username = signup_user
                    st.success("Account created! Data migrated securely. Please close this box.")
                    st.rerun()
                else:
                    st.error("Username already exists.")
            else:
                st.error("Please fill out both fields.")

# ----------------------------------------------------------------------------
# Main Authenticated App
# ----------------------------------------------------------------------------
colTitle, colLogout = st.columns([10, 2])
with colTitle:
    st.title("Inventory Optimizer")
with colLogout:
    if st.session_state.username:
        if st.button("Logout"):
            st.session_state.username = None
            st.rerun()
    else:
        if st.button("Sign Up / Login", type="primary"):
            auth_dialog()

if st.session_state.username:
    st.markdown(f"**Welcome back, {user_id}!** Easily track your inventory and analyze true net profit.")
else:
    st.markdown("**Welcome to Guest Mode!** You can track up to 25 items for free without creating an account!")

# ----------------------------------------------------------------------------
# Data Fetching
# ----------------------------------------------------------------------------
inv_df = database.get_inventory_df(user_id)
sales_df = database.get_sales_df(user_id)

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
# Dialog Modals
# ----------------------------------------------------------------------------
@st.dialog("➕ Add New Item")
def add_item_dialog(user_id):
    name = st.text_input("Item Name (e.g., Jordan 4 White Cement)")
    brand = st.selectbox("Brand", ["Nike", "New Balance", "Adidas", "Amiri", "Supreme", "Chrome Hearts", "Other"])
    size = st.text_input("Size (e.g., 10, M)")
    condition = st.selectbox("Condition", ["New", "Used"])
    purchase_price = st.number_input("Purchase Price ($)", min_value=0.0, format="%.2f", step=10.0)
    date_acquired = st.date_input("Date Acquired", date.today())
    
    if st.button("Add to Inventory", type="primary", use_container_width=True):
        if name and size:
            database.add_item(user_id, name, brand, size, condition, purchase_price, date_acquired.isoformat())
            st.toast(f"{name} added successfully!", icon="✅")
            st.rerun()
        else:
            st.error("Please fill out Name and Size.")

@st.dialog("💰 Record Sale")
def mark_sold_dialog(user_id, active_inv):
    item_options = active_inv.apply(lambda row: f"{row['id']} - {row['Item Name']} (Size {row['Size']})", axis=1).tolist()
    selected_item = st.selectbox("Select Item to Sell", item_options)
    platforms = [
        "StockX", "GOAT / Alias", "eBay (Sneakers >$150)", "eBay (Standard)", 
        "Grailed", "Poshmark", "Depop", "Flight Club", "Stadium Goods", 
        "Mercari", "Vinted", "Local/Cash (No Fee)"
    ]
    platform = st.selectbox("Platform Sold On", platforms)
    sale_price = st.number_input("Final Gross Sale Price ($)", min_value=0.0, format="%.2f", step=10.0)
    shipping_cost = st.number_input("Shipping Label Cost ($)", min_value=0.0, format="%.2f", step=1.0)
    
    if st.button("Submit Sale", type="primary", use_container_width=True):
        if sale_price > 0:
            item_id = int(selected_item.split(" - ")[0])
            try:
                database.mark_as_sold(user_id, item_id, platform, sale_price, shipping_cost)
                st.balloons()
                st.toast(f"Sale recorded on {platform}!", icon="🎉")
                st.rerun()
            except Exception as e:
                st.error(f"Error recording sale: {e}")
        else:
            st.error("Sale price must be greater than $0.")

@st.dialog("📥 Bulk Import (CSV)")
def import_csv_dialog(user_id):
    st.markdown("Upload your StockX, eBay, or personal spreadsheet to instantly populate your inventory.")
    st.markdown("*(Expected columns: Item Name, Brand, Size, Condition, Purchase Price, Date Acquired)*")
    uploaded_file = st.file_uploader("Choose a .csv file", type="csv")
    
    if uploaded_file is not None:
        try:
            df = pd.read_csv(uploaded_file)
            st.success(f"File uploaded! Found {len(df)} rows.")
            
            if st.button("Confirm & Import Data", type="primary", use_container_width=True):
                success_count = 0
                for _, row in df.iterrows():
                    name = str(row.get("Item Name", row.get("Name", "Unknown Item")))
                    brand = str(row.get("Brand", "Other"))
                    size = str(row.get("Size", "N/A"))
                    condition = str(row.get("Condition", "New"))
                    price = float(row.get("Purchase Price", row.get("Price", 0.0)))
                    date_acq = str(row.get("Date Acquired", date.today().isoformat()))
                    database.add_item(user_id, name, brand, size, condition, price, date_acq)
                    success_count += 1
                    
                st.toast(f"Successfully imported {success_count} items!", icon="✅")
                st.rerun()
        except Exception as e:
            st.error(f"Error processing file. Please check your columns. Details: {e}")

# ----------------------------------------------------------------------------
# Sidebar Control & Paywall
# ----------------------------------------------------------------------------
is_pro = database.is_pro_user(user_id)
active_count = len(active_inv)

st.sidebar.header("Inventory Management")

if is_pro or active_count < 25:
    if st.sidebar.button("➕ Add New Item", use_container_width=True):
        add_item_dialog(user_id)
    if st.sidebar.button("📥 Bulk Import CSV", use_container_width=True):
        import_csv_dialog(user_id)
else:
    if not st.session_state.username:
        st.sidebar.warning("🔒 You've hit the 25 item Guest Limit!")
        st.sidebar.markdown("Sign up for a free account to permanently save your data, and unlock access to Stripe Pro checkout!")
        if st.sidebar.button("🔐 Sign Up to continue", use_container_width=True, type="primary"):
            auth_dialog()
    else:
        st.sidebar.warning("🔒 You have reached the 25 active item limit on the free plan.")
        # Example Stripe link (You would replace this with actual Stripe Payment Link)
        st.sidebar.markdown("[🚀 Upgrade to Pro ($9.99/mo)](https://buy.stripe.com/test_123456789) to track unlimited items!")

st.sidebar.markdown("---")
st.sidebar.metric("Active Items Count", f"{active_count} / {25 if not is_pro else 'Unlimited'}")

# ----------------------------------------------------------------------------
# Main Content: Tabs
# ----------------------------------------------------------------------------
tab1, tab2 = st.tabs(["📋 Active Inventory", "💰 Completed Sales"])

with tab1:
    st.subheader("Active Inventory")
    st.dataframe(active_inv, use_container_width=True, hide_index=True)
    
    if not active_inv.empty:
        st.markdown("---")
        if st.button("💰 Record a Sale"):
            mark_sold_dialog(user_id, active_inv)
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
