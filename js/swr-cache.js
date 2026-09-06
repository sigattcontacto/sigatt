// js/swr-cache.js
export const swrCache = {
    cache: new Map(),
    timestamps: new Map(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    
    get(key) {
        if (this.cache.has(key)) {
            const timestamp = this.timestamps.get(key) || 0;
            const now = Date.now();
            
            // Si está fresco, devolver
            if (now - timestamp < this.staleTime) {
                console.log(`✅ Cache hit: ${key}`);
                return this.cache.get(key);
            }
            
            // Si está stale, devolver y revalidar en background
            console.log(`⏳ Cache stale: ${key}, revalidando...`);
            setTimeout(() => this.revalidateKey(key), 0);
            return this.cache.get(key);
        }
        
        console.log(`❌ Cache miss: ${key}`);
        return null;
    },
    
    set(key, value) {
        this.cache.set(key, value);
        this.timestamps.set(key, Date.now());
        console.log(`💾 Cache set: ${key}`);
    },
    
    invalidate(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        console.log(`🗑️ Cache invalidated: ${key}`);
    },
    
    revalidateKey(key) {
        // Implementar revalidación según necesidad
        console.log(`🔄 Revalidando: ${key}`);
        // Aquí iría la lógica de revalidación
    },
    
    revalidate() {
        console.log('🔄 Revalidando todo el caché...');
        // Revalidar solo los keys que necesiten
    },
    
    clear() {
        this.cache.clear();
        this.timestamps.clear();
        console.log('🧹 Cache limpiado');
    }
};
