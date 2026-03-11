import streamlit as st
import pandas as pd
from datetime import date
import uuid
import os
from dotenv import load_dotenv
import database

load_dotenv()

# Configure the Streamlit page layout
st.set_page_config(page_title="Resell Optimizer", page_icon="📈", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
    /* Metric Cards - Clean SaaS */
    [data-testid="stMetricValue"] {
        font-size: 2.2rem !important;
        font-weight: 800 !important;
        color: #0f172a !important; /* Dark Slate for numbers */
    }
    [data-testid="stMetricLabel"] {
        color: #64748b !important; /* Cool gray for labels */
        font-weight: 600 !important;
    }
    [data-testid="stMetric"] {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    
    /* Clean Dataframes */
    [data-testid="stDataFrame"] {
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
    }
    
    /* Professional Blue Buttons (Like Stripe/Shopify) */
    .stButton>button {
        border-radius: 8px !important;
        font-weight: 600 !important;
        transition: all 0.2s ease !important;
        border: 1px solid #2563eb !important;
        background-color: #ffffff;
        color: #2563eb !important;
    }
    .stButton>button:hover {
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2) !important;
        transform: translateY(-1px) !important;
        background-color: #f8fafc !important;
    }
    
    /* Primary Action Buttons */
    button[kind="primary"] {
        background-color: #2563eb !important;
        color: #ffffff !important;
    }
    button[kind="primary"]:hover {
        background-color: #1d4ed8 !important;
        color: #ffffff !important;
    }
    
    /* Clean Top Header */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

st.logo("logo.png")

# Attempt to configure Gemini AI
try:
    import google.generativeai as genai
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and api_key != 'your_api_key_here':
        genai.configure(api_key=api_key)
        has_ai = True
    else:
        has_ai = False
except ImportError:
    has_ai = False

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
    st.title("📈 Resell Optimizer")
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

@st.dialog("✨ AI SEO Listing Generator")
def ai_listing_dialog(active_inv):
    if not has_ai:
        st.error("AI Generation is currently unavailable. Please provide your Gemini API key in the bottom corner.")
        return
        
    item_options = active_inv.apply(lambda row: f"{row['id']} - {row['Item Name']} (Size {row['Size']})", axis=1).tolist()
    selected_item = st.selectbox("Select Item to Generate Listing For", item_options)
    
    if st.button("Generate Description", type="primary", use_container_width=True):
        item_id = int(selected_item.split(" - ")[0])
        row = active_inv[active_inv['id'] == item_id].iloc[0]
        
        item_name = row['Item Name']
        brand = row['Brand']
        size = row['Size']
        condition = row['Condition']
        
        generating = st.empty()
        generating.info("Generating your SEO-optimized title and description... Please wait.")
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = f"Act as an expert reseller on eBay and Poshmark. Write a highly SEO-optimized product title and a compelling, detailed product description for the following item:\nItem Name: {item_name}\nBrand: {brand}\nSize: {size}\nCondition: {condition}\nFormat the output with two headers: 'Optimized Title' and 'Product Description'. Keep the title under 80 characters."
            response = model.generate_content(prompt)
            generating.empty()
            st.success("Generation Complete!")
            st.markdown(response.text)
        except Exception as e:
            generating.empty()
            st.error(f"Failed to generate listing: {e}")

# ----------------------------------------------------------------------------
# Sidebar Control & Paywall
# ----------------------------------------------------------------------------
user_tier = database.get_user_tier(user_id)
active_count = len(active_inv)

# Determine Limits
if user_tier == 'Pro':
    limit = float('inf')
    limit_str = 'Unlimited'
elif user_tier == 'Basic':
    limit = 100
    limit_str = '100'
else:
    limit = 25
    limit_str = '25'

st.sidebar.header("Inventory Management")

if active_count < limit:
    if st.sidebar.button("➕ Add New Item", use_container_width=True):
        add_item_dialog(user_id)
    if st.sidebar.button("📥 Bulk Import CSV", use_container_width=True):
        import_csv_dialog(user_id)
else:
    if not st.session_state.username:
        st.sidebar.warning(f"🔒 You've hit the {limit_str} item Guest Limit!")
        st.sidebar.markdown("Sign up for a free account to permanently save your data, and unlock access to Stripe upgrades!")
        if st.sidebar.button("🔐 Sign Up to continue", use_container_width=True, type="primary"):
            auth_dialog()
    elif user_tier == 'Free':
        st.sidebar.warning(f"🔒 You have reached the {limit_str} active item limit on the Free plan.")
        st.sidebar.markdown("[🚀 Upgrade to Basic ($15/mo)](https://buy.stripe.com/test_123456789) for 100 items.")
        st.sidebar.markdown("[⚡️ Upgrade to Pro ($35/mo)](https://buy.stripe.com/test_987654321) for Unlimited + AI Features.")
    elif user_tier == 'Basic':
        st.sidebar.warning(f"🔒 You have reached the {limit_str} active item limit on the Basic plan.")
        st.sidebar.markdown("[⚡️ Upgrade to Pro ($35/mo)](https://buy.stripe.com/test_987654321) for Unlimited + AI Features.")

st.sidebar.markdown("---")
st.sidebar.metric(f"{user_tier} Plan Limit", f"{active_count} / {limit_str}")

# ----------------------------------------------------------------------------
# Main Content: Tabs
# ----------------------------------------------------------------------------
tab1, tab2, tab3 = st.tabs(["📋 Active Inventory", "💰 Completed Sales", "🔍 Margin Analyzer"])

with tab1:
    st.subheader("Active Inventory")
    st.dataframe(active_inv, use_container_width=True, hide_index=True)
    
    if not active_inv.empty:
        st.markdown("---")
        colSale, colAI = st.columns(2)
        with colSale:
            if st.button("💰 Record a Sale", use_container_width=True):
                mark_sold_dialog(user_id, active_inv)
        with colAI:
            if user_tier == 'Pro':
                if st.button("✨ Auto-Generate AI Listing", use_container_width=True):
                    ai_listing_dialog(active_inv)
            else:
                st.button("✨ Auto-Generate AI Listing (Pro Only)", use_container_width=True, disabled=True)
                st.caption("Upgrade to Pro to unlock 1-click SEO listing generation for eBay & Poshmark.")
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

with tab3:
    st.subheader("Margin Analyzer Engine")
    st.markdown("Instantly compare potential profit across all platforms before you list an item.")
    
    colA, colB, colC = st.columns(3)
    with colA:
        analyze_buy = st.number_input("Target Buy Cost ($)", min_value=0.0, format="%.2f", step=10.0, value=150.0)
    with colB:
        analyze_sell = st.number_input("Target Sell Price ($)", min_value=0.0, format="%.2f", step=10.0, value=250.0)
    with colC:
        analyze_ship = st.number_input("Estimated Shipping ($)", min_value=0.0, format="%.2f", step=1.0, value=0.0)
        
    st.markdown("---")
    
    # Run the engine across all supported platforms
    platforms = [
        "StockX", "GOAT / Alias", "eBay (Sneakers >$150)", "eBay (Standard)", 
        "Grailed", "Poshmark", "Depop", "Flight Club", "Stadium Goods", 
        "Mercari", "Vinted"
    ]
    
    results = []
    for p in platforms:
        fee = database.calculate_fee(p, analyze_sell)
        net = analyze_sell - analyze_buy - fee - analyze_ship
        margin = (net / analyze_buy) * 100 if analyze_buy > 0 else 0
        results.append({
            "Platform": p,
            "Total Fees": fee,
            "Net Profit": net,
            "ROI (%)": f"{margin:.1f}%"
        })
        
    res_df = pd.DataFrame(results)
    res_df = res_df.sort_values("Net Profit", ascending=False)
    
    # Display the engine results
    colChart, colTable = st.columns([1, 1])
    with colChart:
        st.bar_chart(data=res_df, x="Platform", y="Net Profit", color="#a855f7")
    with colTable:
        def color_net(val):
            return f'color: {"#22c55e" if float(val) > 0 else "#ef4444"}; font-weight: bold'
        st.dataframe(
            res_df.style.map(color_net, subset=['Net Profit']), 
            use_container_width=True, 
            hide_index=True
        )
