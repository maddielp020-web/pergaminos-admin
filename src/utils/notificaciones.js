// ==================== NOTIFICACIONES ====================
const ADMIN_IDS = process.env.ADMIN_IDS
    ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
    : [];

// ==================== HELPER ====================
// FIX: escapar HTML para evitar crashes cuando el nombre/enlace tiene caracteres especiales
function esc(texto) {
    if (!texto) return '';
    return texto.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ==================== FUNCIONES ====================
async function notificarAdministradores(telegram, mensaje) {
    for (const adminId of ADMIN_IDS) {
        try {
            await telegram.sendMessage(adminId, mensaje, { parse_mode: 'HTML' });
        } catch (error) {
            console.error(`❌ Error al notificar a admin ${adminId}: ${error.message}`);
        }
    }
}

async function notificarEnlaceProhibido(telegram, usuario, enlaces) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);
    const enlacesStr = enlaces.map(e => esc(e)).join('\n• ');

    const mensaje =
        `🚫 <b>ENLACE PROHIBIDO DETECTADO</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        `🔗 <b>Enlace(s):</b>\n• ${enlacesStr}\n\n` +
        `✅ El mensaje ha sido eliminado automáticamente.`;

    await notificarAdministradores(telegram, mensaje);
}

async function notificarContenidoProhibido(telegram, usuario, palabras, emojis) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);

    let detalles = '';
    if (palabras && palabras.length > 0) {
        detalles += `📝 <b>Palabras:</b> ${palabras.map(esc).join(', ')}\n`;
    }
    if (emojis && emojis.length > 0) {
        detalles += `😀 <b>Emojis:</b> ${emojis.join(' ')}\n`;
    }

    const mensaje =
        `⚠️ <b>CONTENIDO PROHIBIDO DETECTADO</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        detalles +
        `\n✅ El mensaje ha sido eliminado automáticamente.`;

    await notificarAdministradores(telegram, mensaje);
}

async function notificarFeedbackNegativo(telegram, usuario, contexto) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);

    const mensaje =
        `👎 <b>FEEDBACK NEGATIVO RECIBIDO</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        `💬 <b>Contexto:</b> ${esc(contexto)}\n\n` +
        `🔍 Revisa el grupo para ver qué buscó el usuario.`;

    await notificarAdministradores(telegram, mensaje);
}

// ==================== EXPORTS ====================
module.exports = {
    notificarAdministradores,
    notificarEnlaceProhibido,
    notificarContenidoProhibido,
    notificarFeedbackNegativo
};