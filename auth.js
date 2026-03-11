'use strict';
/**
 * middleware/auth.js
 *
 * requireAuth — verifies the Clerk JWT on every protected request.
 *
 * Uses @clerk/express getAuth() which reads the Bearer token set by
 * clerkMiddleware() (applied globally in index.js).
 *
 * On success: attaches req.userId (Clerk user ID string) and calls next().
 * On failure: responds 401.
 */
const { getAuth } = require('@clerk/express');

function requireAuth(req, res, next) {
    const { userId } = getAuth(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized — valid Clerk session required' });
    }
    req.userId = userId; // e.g. "user_2abc123..."
    next();
}

module.exports = { requireAuth };
