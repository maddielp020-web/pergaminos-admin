// ==================== IMPORTACIONES ====================
require('dotenv').config();

// ==================== CONSTANTES ====================
const BOT_TOKEN = process.env.BOT_TOKEN_ADMIN;
const ADMIN_IDS = process.env.ADMIN_IDS
    ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
    : [];
const PORT = process.env.PORT || 3000;

// ==================== VALIDACION ====================
if (!BOT_TOKEN) {
    console.error('❌ ERROR: BOT_TOKEN_ADMIN no está definido en .env');
    process.exit(1);
}

if (ADMIN_IDS.length === 0) {
    console.warn('⚠️ ADVERTENCIA: ADMIN_IDS está vacío. Nadie recibirá notificaciones.');
}

console.log('✅ Configuración cargada correctamente');
console.log(`   📍 Puerto: ${PORT}`);
console.log(`   👑 Admins: ${ADMIN_IDS.join(', ')}`);

// ==================== EXPORTS ====================
module.exports = { BOT_TOKEN, ADMIN_IDS, PORT };