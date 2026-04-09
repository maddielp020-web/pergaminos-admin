// ==================== IMPORTACIONES ====================
require('dotenv').config();
const express = require('express');
const { PORT, BOT_TOKEN } = require('./src/config');

// ==================== VALIDACION ====================
if (!BOT_TOKEN) {
    console.error('❌ ERROR: BOT_TOKEN_ADMIN no está configurado en .env');
    process.exit(1);
}

// ==================== SERVIDOR_HTTP ====================
const app = express();

app.get('/', (req, res) => {
    res.send('✅ PergaminosAdmin_Bot está funcionando');
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'PergaminosAdmin_Bot',
        timestamp: new Date().toISOString()
    });
});

// ==================== INICIO_BOT ====================
const bot = require('./src/bot');
let botIniciado = false;

const iniciarBot = async () => {
    if (botIniciado) return;

    try {
        // FIX: solo deleteWebhook + dropPendingUpdates en launch
        // El getUpdates extra era redundante y podía causar conflictos
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('✅ Webhook limpiado');

        await bot.launch({
            allowedUpdates: ['message', 'callback_query'],
            dropPendingUpdates: true
        });

        botIniciado = true;
        console.log('✅ Bot iniciado correctamente en modo Long Polling');
        console.log('🛡️ Filtros activos: enlaces, palabras, emojis');
        console.log('💬 Feedback: activado por comando /feedback');

    } catch (err) {
        console.error('❌ Error al iniciar el bot:', err.message);
        process.exit(1);
    }
};

// ==================== ARRANQUE ====================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor HTTP en puerto ${PORT}`);
    console.log(`   Health check: http://0.0.0.0:${PORT}/health`);

    // Esperar 1.5s a que el servidor esté estable antes de arrancar el bot
    setTimeout(iniciarBot, 1500);
});

// ==================== CIERRE_LIMPIO ====================
process.once('SIGINT', () => {
    console.log('🛑 Cerrando bot (SIGINT)...');
    bot.stop('SIGINT');
    server.close(() => process.exit(0));
});

process.once('SIGTERM', () => {
    console.log('🛑 Cerrando bot (SIGTERM)...');
    bot.stop('SIGTERM');
    server.close(() => process.exit(0));
});

console.log('🚀 Iniciando PergaminosAdmin_Bot...');
