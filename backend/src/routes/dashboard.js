'use strict';
const express = require('express');
const router = express.Router();
const { query, isPg } = require('../db/client');
const { requireAuth } = require('../middleware/auth');

const flt = (v) => parseFloat(parseFloat(v || 0).toFixed(2));

// All dashboard routes require authentication
router.use(requireAuth);

router.get('/', async (req, res) => {
    const uid = req.userId;
    const thirtyDaysAgo = isPg
        ? `date_sold >= CURRENT_DATE - INTERVAL '30 days'`
        : `date_sold >= date('now', '-30 days')`;

    try {
        const [
            inventoryStats,
            salesStats,
            soldCostBasisResult,
            platformBreakdown,
            thirtyDayStats,
            recentSales,
            topFlips,
        ] = await Promise.all([
            query(
                `SELECT COUNT(*) AS total_items,
           COALESCE(SUM(CASE WHEN status='In Stock' THEN 1    ELSE 0 END),0) AS in_stock_count,
           COALESCE(SUM(CASE WHEN status='Sold'     THEN 1    ELSE 0 END),0) AS sold_count,
           COALESCE(SUM(CASE WHEN status='In Stock' THEN purchase_price ELSE 0 END),0) AS total_invested,
           COALESCE(SUM(purchase_price),0) AS total_cost_basis
         FROM inventory WHERE user_id = $1`,
                [uid]
            ),
            query(
                `SELECT COALESCE(SUM(sale_price),0) AS total_revenue,
           COALESCE(SUM(net_profit),0) AS total_net_profit,
           COALESCE(SUM(platform_fee),0) AS total_fees,
           COALESCE(SUM(shipping_cost),0) AS total_shipping,
           COUNT(*) AS total_sales
         FROM sales WHERE user_id = $1`,
                [uid]
            ),
            query(
                `SELECT COALESCE(SUM(i.purchase_price),0) AS value
         FROM sales s JOIN inventory i ON s.inventory_id = i.id
         WHERE s.user_id = $1`,
                [uid]
            ),
            query(
                `SELECT platform, COUNT(*) AS sales_count,
           COALESCE(SUM(sale_price),0) AS revenue,
           COALESCE(SUM(net_profit),0) AS net_profit,
           COALESCE(SUM(platform_fee),0) AS total_fees
         FROM sales WHERE user_id = $1
         GROUP BY platform ORDER BY net_profit DESC`,
                [uid]
            ),
            query(
                `SELECT COALESCE(SUM(net_profit),0) AS net_profit_30d, COUNT(*) AS sales_count_30d
         FROM sales WHERE user_id = $1 AND ${thirtyDaysAgo}`,
                [uid]
            ),
            query(
                `SELECT s.*, i.item_name, i.brand, i.size
         FROM sales s JOIN inventory i ON s.inventory_id = i.id
         WHERE s.user_id = $1
         ORDER BY s.date_sold DESC, s.created_at DESC LIMIT 5`,
                [uid]
            ),
            query(
                `SELECT s.id, i.item_name, i.brand, i.size, i.purchase_price,
                s.sale_price, s.platform, s.platform_fee, s.shipping_cost, s.net_profit, s.date_sold
         FROM sales s JOIN inventory i ON s.inventory_id = i.id
         WHERE s.user_id = $1 ORDER BY s.net_profit DESC LIMIT 5`,
                [uid]
            ),
        ]);

        const inv = inventoryStats.rows[0];
        const ss = salesStats.rows[0];
        const scb = soldCostBasisResult.rows[0];
        const td = thirtyDayStats.rows[0];

        const soldCostBasis = flt(scb.value);
        const totalNetProfit = flt(ss.total_net_profit);
        const roi = soldCostBasis > 0
            ? parseFloat(((totalNetProfit / soldCostBasis) * 100).toFixed(2))
            : 0;

        res.json({
            total_items: Number(inv.total_items),
            in_stock_count: Number(inv.in_stock_count),
            sold_count: Number(inv.sold_count),
            total_invested: flt(inv.total_invested),
            total_cost_basis: flt(inv.total_cost_basis),
            total_sales: Number(ss.total_sales),
            total_revenue: flt(ss.total_revenue),
            total_net_profit: totalNetProfit,
            total_fees: flt(ss.total_fees),
            total_shipping: flt(ss.total_shipping),
            roi_percent: roi,
            net_profit_30d: flt(td.net_profit_30d),
            sales_count_30d: Number(td.sales_count_30d),
            platform_breakdown: platformBreakdown.rows.map(r => ({
                ...r,
                sales_count: Number(r.sales_count),
                revenue: flt(r.revenue),
                net_profit: flt(r.net_profit),
                total_fees: flt(r.total_fees),
            })),
            recent_sales: recentSales.rows,
            top_flips: topFlips.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
