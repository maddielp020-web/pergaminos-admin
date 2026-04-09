// ==================== CACHE_ADMINS ====================
// FIX: cachear resultado de getChatMember para evitar rate limit de Telegram
// cuando hay muchos mensajes en el grupo simultáneamente.
// TTL de 5 minutos — suficiente para no sobrecargar la API.

const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 minutos

async function esAdminDelGrupo(telegram, chatId, userId) {
    const key = `${chatId}_${userId}`;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.ts < TTL) {
        return cached.esAdmin;
    }

    try {
        const member = await telegram.getChatMember(chatId, userId);
        const esAdmin = ['creator', 'administrator'].includes(member.status);
        cache.set(key, { esAdmin, ts: Date.now() });
        return esAdmin;
    } catch (error) {
        console.error(`❌ Error al verificar admin ${userId}: ${error.message}`);
        // En caso de error, asumir que NO es admin para no saltarse los filtros
        return false;
    }
}

// Limpieza periódica del cache cada 10 minutos
setInterval(() => {
    const ahora = Date.now();
    for (const [key, val] of cache) {
        if (ahora - val.ts > TTL) cache.delete(key);
    }
}, 10 * 60 * 1000);

module.exports = { esAdminDelGrupo };