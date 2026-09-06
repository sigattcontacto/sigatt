// js/rate-limit.js
export function rateLimit(options = {}) {
    const {
        maxRequests = 5,
        windowMs = 60000
    } = options;
    
    const requests = new Map();
    
    return {
        check: (identifier = 'default') => {
            const now = Date.now();
            const windowStart = now - windowMs;
            
            if (!requests.has(identifier)) {
                requests.set(identifier, []);
            }
            
            const userRequests = requests.get(identifier);
            const validRequests = userRequests.filter(time => time > windowStart);
            
            if (validRequests.length >= maxRequests) {
                return false;
            }
            
            validRequests.push(now);
            requests.set(identifier, validRequests);
            return true;
        },
        
        getRemaining: (identifier = 'default') => {
            const now = Date.now();
            const windowStart = now - windowMs;
            const userRequests = requests.get(identifier) || [];
            const validRequests = userRequests.filter(time => time > windowStart);
            return Math.max(0, maxRequests - validRequests.length);
        },
        
        reset: (identifier = 'default') => {
            requests.delete(identifier);
        }
    };
}
