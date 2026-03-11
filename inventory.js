'use strict';
const express = require('express');
const router = express.Router();
const { query } = require('../db/client');
const { requireAuth } = require('../middleware/auth');

const VALID_CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];

// All inventory routes require authentication
router.use(requireAuth);

// ── GET /api/inventory ─────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const result = status
            ? await query(
                'SELECT * FROM inventory WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
                [req.userId, status]
            )
            : await query(
                'SELECT * FROM inventory WHERE user_id = $1 ORDER BY created_at DESC',
                [req.userId]
            );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/inventory/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM inventory WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/inventory ────────────────────────────────────────
router.post('/', async (req, res) => {
    const { item_name, brand, size, condition, purchase_price, date_acquired, notes } = req.body;

    if (!item_name || !brand)
        return res.status(400).json({ error: 'item_name and brand are required' });
    if (condition && !VALID_CONDITIONS.includes(condition))
        return res.status(400).json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` });

    try {
        const inserted = await query(
            `INSERT INTO inventory (user_id, item_name, brand, size, condition, purchase_price, date_acquired, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
            [
                req.userId,
                item_name,
                brand,
                size ?? null,
                condition ?? 'New',
                purchase_price ?? 0,
                date_acquired ?? new Date().toISOString().slice(0, 10),
                notes ?? null,
            ]
        );
        const id = inserted.rows[0].id;
        const row = await query(
            'SELECT * FROM inventory WHERE id = $1 AND user_id = $2',
            [id, req.userId]
        );
        res.status(201).json(row.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/inventory/:id ─────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const existing = await query(
            'SELECT * FROM inventory WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );
        if (!existing.rows.length) return res.status(404).json({ error: 'Item not found' });
        const item = existing.rows[0];
        if (item.status === 'Sold') return res.status(409).json({ error: 'Cannot edit a sold item' });

        const { item_name, brand, size, condition, purchase_price, date_acquired, notes } = req.body;
        const now = new Date().toISOString();

        await query(
            `UPDATE inventory
       SET item_name=$1, brand=$2, size=$3, condition=$4,
           purchase_price=$5, date_acquired=$6, notes=$7, updated_at=$8
       WHERE id=$9 AND user_id=$10`,
            [
                item_name ?? item.item_name,
                brand ?? item.brand,
                size ?? item.size,
                condition ?? item.condition,
                purchase_price ?? item.purchase_price,
                date_acquired ?? item.date_acquired,
                notes ?? item.notes,
                now,
                req.params.id,
                req.userId,
            ]
        );
        const updated = await query(
            'SELECT * FROM inventory WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/inventory/:id ──────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM inventory WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
        if (result.rows[0].status === 'Sold')
            return res.status(409).json({ error: 'Cannot delete a sold item. Delete its sale record first.' });

        await query(
            'DELETE FROM inventory WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );
        res.json({ message: 'Item deleted', id: Number(req.params.id) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
