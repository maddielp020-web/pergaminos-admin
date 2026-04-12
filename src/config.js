// ==================== IMPORTACIONES ====================
require('dotenv').config();

// ==================== CONSTANTES ====================
const BOT_TOKEN = process.env.BOT_TOKEN_ADMIN;
const CREATEDOR_ID = 2022025893; // ID fijo del creador
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
console.log(`   👑 Creador: ${CREATEDOR_ID}`);
console.log(`   🛡️ Admins adicionales: ${ADMIN_IDS.filter(id => id !== CREATEDOR_ID).join(', ') || 'ninguno'}`);

// ==================== EXPORTS ====================
module.exports = { BOT_TOKEN, CREATEDOR_ID, ADMIN_IDS, PORT };