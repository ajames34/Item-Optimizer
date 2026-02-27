'use strict';
const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db/client');
const { requireAuth } = require('../middleware/auth');

// All sales routes require authentication
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────
// Platform Fee Engine (unchanged)
// ─────────────────────────────────────────────────────────────
const PLATFORMS = ['StockX', 'eBay', 'Poshmark', 'Depop'];

function calculatePlatformFee(platform, salePrice) {
    switch (platform) {
        case 'StockX': {
            const txFee = salePrice * 0.09;
            const pmtFee = salePrice * 0.03;
            return {
                platform_fee: parseFloat((txFee + pmtFee).toFixed(2)),
                fee_breakdown: `StockX: 9% transaction ($${txFee.toFixed(2)}) + 3% payment ($${pmtFee.toFixed(2)})`
            };
        }
        case 'eBay': {
            const pctFee = salePrice * 0.1325;
            return {
                platform_fee: parseFloat((pctFee + 0.30).toFixed(2)),
                fee_breakdown: `eBay: 13.25% ($${pctFee.toFixed(2)}) + $0.30 fixed`
            };
        }
        case 'Poshmark': {
            const fee = salePrice * 0.20;
            return {
                platform_fee: parseFloat(fee.toFixed(2)),
                fee_breakdown: `Poshmark: 20% flat ($${fee.toFixed(2)})`
            };
        }
        case 'Depop': {
            const depopFee = salePrice * 0.10;
            const pmtFee = salePrice * 0.029 + 0.30;
            return {
                platform_fee: parseFloat((depopFee + pmtFee).toFixed(2)),
                fee_breakdown: `Depop: 10% ($${depopFee.toFixed(2)}) + 2.9%+$0.30 processing ($${pmtFee.toFixed(2)})`
            };
        }
        default:
            throw new Error(`Unknown platform. Must be one of: ${PLATFORMS.join(', ')}`);
    }
}

// ─────────────────────────────────────────────────────────────
// GET /api/sales — Only this user's sales
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT s.*, i.item_name, i.brand, i.size, i.condition, i.purchase_price
       FROM sales s
       JOIN inventory i ON s.inventory_id = i.id
       WHERE s.user_id = $1
       ORDER BY s.date_sold DESC, s.created_at DESC
       LIMIT 200`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/sales/preview
// ─────────────────────────────────────────────────────────────
router.get('/preview', async (req, res) => {
    const { inventory_id, sale_price, platform, shipping_cost } = req.query;
    if (!inventory_id || !sale_price || !platform)
        return res.status(400).json({ error: 'inventory_id, sale_price, and platform are required' });

    try {
        // Verify ownership
        const itemResult = await query(
            'SELECT * FROM inventory WHERE id = $1 AND user_id = $2',
            [inventory_id, req.userId]
        );
        if (!itemResult.rows.length) return res.status(404).json({ error: 'Inventory item not found' });
        const item = itemResult.rows[0];

        const grossSalePrice = parseFloat(sale_price);
        const ship = parseFloat(shipping_cost ?? 0);
        const { platform_fee, fee_breakdown } = calculatePlatformFee(platform, grossSalePrice);
        const net_profit = parseFloat(
            (grossSalePrice - parseFloat(item.purchase_price) - platform_fee - ship).toFixed(2)
        );

        res.json({
            item_name: item.item_name, brand: item.brand, purchase_price: parseFloat(item.purchase_price),
            sale_price: grossSalePrice, platform, platform_fee, fee_breakdown, shipping_cost: ship, net_profit
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/sales — Record a sale (atomic)
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const { inventory_id, sale_price, platform, shipping_cost, date_sold, notes } = req.body;

    if (!inventory_id || !sale_price || !platform)
        return res.status(400).json({ error: 'inventory_id, sale_price, and platform are required' });
    if (!PLATFORMS.includes(platform))
        return res.status(400).json({ error: `platform must be one of: ${PLATFORMS.join(', ')}` });
    if (Number(sale_price) <= 0)
        return res.status(400).json({ error: 'sale_price must be greater than 0' });

    try {
        const sale = await transaction(async (q) => {
            // Verify item exists and belongs to this user
            const itemResult = await q(
                'SELECT * FROM inventory WHERE id = $1 AND user_id = $2',
                [inventory_id, req.userId]
            );
            if (!itemResult.rows.length) throw new Error('Inventory item not found');
            const item = itemResult.rows[0];
            if (item.status === 'Sold') throw new Error('This item has already been sold');

            const grossSalePrice = parseFloat(sale_price);
            const ship = parseFloat(shipping_cost ?? 0);
            const { platform_fee, fee_breakdown } = calculatePlatformFee(platform, grossSalePrice);
            const net_profit = parseFloat(
                (grossSalePrice - parseFloat(item.purchase_price) - platform_fee - ship).toFixed(2)
            );
            const now = new Date().toISOString();

            const saleInsert = await q(
                `INSERT INTO sales (user_id, inventory_id, sale_price, platform, platform_fee, shipping_cost, net_profit, date_sold, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
                [req.userId, inventory_id, grossSalePrice, platform, platform_fee, ship, net_profit,
                date_sold ?? new Date().toISOString().slice(0, 10), notes ?? null]
            );
            const saleId = saleInsert.rows[0].id;

            await q(`UPDATE inventory SET status='Sold', updated_at=$1 WHERE id=$2 AND user_id=$3`,
                [now, inventory_id, req.userId]);

            const fullSale = await q(
                `SELECT s.*, i.item_name, i.brand, i.size, i.condition, i.purchase_price
         FROM sales s JOIN inventory i ON s.inventory_id = i.id
         WHERE s.id = $1 AND s.user_id = $2`,
                [saleId, req.userId]
            );
            return { ...fullSale.rows[0], fee_breakdown };
        });

        res.status(201).json(sale);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/sales/:id — Undo a sale
// ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const result = await transaction(async (q) => {
            const saleResult = await q(
                'SELECT * FROM sales WHERE id = $1 AND user_id = $2',
                [req.params.id, req.userId]
            );
            if (!saleResult.rows.length) throw new Error('Sale not found');
            const sale = saleResult.rows[0];
            const now = new Date().toISOString();

            await q(`UPDATE inventory SET status='In Stock', updated_at=$1 WHERE id=$2 AND user_id=$3`,
                [now, sale.inventory_id, req.userId]);
            await q('DELETE FROM sales WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
            return { message: `Sale #${req.params.id} deleted. Item restored to In Stock.` };
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
