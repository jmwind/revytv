// Clerk JWT verification for API routes
const { createClerkClient } = require('@clerk/backend');

let _clerk;
function getClerk() {
    if (!_clerk) {
        _clerk = createClerkClient({
            secretKey: process.env.CLERK_SECRET_KEY,
            publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
        });
    }
    return _clerk;
}

async function verifyAuth(req) {
    try {
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
        const url = `${protocol}://${host}${req.url}`;

        const requestLike = new Request(url, {
            method: req.method,
            headers: req.headers,
        });

        const { isSignedIn, toAuth } = await getClerk().authenticateRequest(requestLike, {
            authorizedParties: ['http://localhost:3000', 'http://localhost:5173', 'https://revytv.vercel.app', 'https://truflake.com'],
        });
        if (!isSignedIn) return null;
        const auth = toAuth();
        return { userId: auth.userId };
    } catch (err) {
        console.error('Auth verification failed:', err.message);
        return null;
    }
}

module.exports = { verifyAuth };
