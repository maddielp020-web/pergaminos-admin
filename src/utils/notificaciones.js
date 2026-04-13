// ==================== NOTIFICACIONES ====================
const { ADMIN_IDS, CREATEDOR_ID } = require('../config');

// ==================== HELPER ====================
function esc(texto) {
    if (!texto) return '';
    return texto.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function construirEnlaceMensaje(chatId, messageId) {
    const chatIdStr = String(chatId).replace('-100', '');
    return `https://t.me/c/${chatIdStr}/${messageId}`;
}

// ==================== FUNCIONES ====================
async function notificarAdministradores(telegram, mensaje) {
    // Enviar a todos los admins (incluye al creador si está en ADMIN_IDS)
    for (const adminId of ADMIN_IDS) {
        try {
            await telegram.sendMessage(adminId, mensaje, { parse_mode: 'HTML' });
        } catch (error) {
            console.error(`❌ Error al notificar a admin ${adminId}: ${error.message}`);
        }
    }
}

/**
 * Envía notificación SOLO al creador (ID fijo)
 */
async function notificarCreador(telegram, mensaje) {
    try {
        telegram.sendMessage(CREATEDOR_ID, mensaje, { parse_mode: 'HTML' });
    } catch (error) {
        console.error(`❌ Error al notificar al creador: ${error.message}`);
    }
}

async function notificarEnlaceProhibido(telegram, usuario, enlaces, esCreador = false) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);
    const enlacesStr = enlaces.map(e => esc(e)).join('\n• ');

    let mensaje =
        `🚫 <b>ENLACE PROHIBIDO DETECTADO</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        `🔗 <b>Enlace(s):</b>\n• ${enlacesStr}\n\n` +
        `✅ El mensaje ha sido eliminado automáticamente.`;
    
    if (esCreador) {
        mensaje += `\n\nℹ️ <i>El mensaje NO fue eliminado porque eres el creador.</i>`;
    }

    await notificarAdministradores(telegram, mensaje);
}

async function notificarContenidoProhibido(telegram, usuario, palabras, emojis, esCreador = false) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);

    let detalles = '';
    if (palabras && palabras.length > 0) {
        detalles += `📝 <b>Palabras:</b> ${palabras.map(esc).join(', ')}\n`;
    }
    if (emojis && emojis.length > 0) {
        detalles += `😀 <b>Emojis:</b> ${emojis.join(' ')}\n`;
    }

    let mensaje =
        `⚠️ <b>CONTENIDO PROHIBIDO DETECTADO</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        detalles +
        `\n✅ El mensaje ha sido eliminado automáticamente.`;
    
    if (esCreador) {
        mensaje += `\n\nℹ️ <i>El mensaje NO fue eliminado porque eres el creador.</i>`;
    }

    await notificarAdministradores(telegram, mensaje);
}

async function notificarAvisoComando(telegram, chatId, messageId, usuario, comando, palabraDetectada, esCreador = false) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);
    const enlaceMensaje = construirEnlaceMensaje(chatId, messageId);

    let mensaje =
        `🛡️ <b>AVISO DEL GUARDIÁN</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        `📝 <b>Comando:</b> ${esc(comando)}\n` +
        `⚠️ <b>Palabra detectada:</b> "${esc(palabraDetectada)}"\n\n` +
        `🔗 <b>Enlace al mensaje:</b> ${enlaceMensaje}\n\n` +
        `ℹ️ <i>No se ha borrado automáticamente. Evalúa si merece acción manual.</i>`;
    
    if (esCreador) {
        mensaje += `\n\nℹ️ <i>Este mensaje es tuyo (creador).</i>`;
    }

    await notificarCreador(telegram, mensaje);
}

async function notificarAvisoEnlaceCreador(telegram, chatId, messageId, usuario, enlaces) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);
    const enlaceMensaje = construirEnlaceMensaje(chatId, messageId);
    const enlacesStr = enlaces.map(e => esc(e)).join('\n• ');

    const mensaje =
        `🚫 <b>ENLACE PROHIBIDO DETECTADO (CREADOR)</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        `🔗 <b>Enlace(s):</b>\n• ${enlacesStr}\n\n` +
        `🔗 <b>Enlace al mensaje:</b> ${enlaceMensaje}\n\n` +
        `ℹ️ <i>El mensaje NO fue eliminado porque eres el creador.</i>`;

    await notificarCreador(telegram, mensaje);
}

async function notificarAvisoContenidoCreador(telegram, chatId, messageId, usuario, palabras, emojis) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);
    const enlaceMensaje = construirEnlaceMensaje(chatId, messageId);

    let detalles = '';
    if (palabras && palabras.length > 0) {
        detalles += `📝 <b>Palabras:</b> ${palabras.map(esc).join(', ')}\n`;
    }
    if (emojis && emojis.length > 0) {
        detalles += `😀 <b>Emojis:</b> ${emojis.join(' ')}\n`;
    }

    const mensaje =
        `⚠️ <b>CONTENIDO PROHIBIDO DETECTADO (CREADOR)</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        detalles +
        `\n🔗 <b>Enlace al mensaje:</b> ${enlaceMensaje}\n\n` +
        `ℹ️ <i>El mensaje NO fue eliminado porque eres el creador.</i>`;

    await notificarCreador(telegram, mensaje);
}

async function notificarFeedbackNegativo(telegram, usuario, textoFeedback, messageId, chatId) {
    const nombre = usuario.username ? `@${esc(usuario.username)}` : esc(usuario.first_name);
    const enlaceMensaje = messageId ? construirEnlaceMensaje(chatId, messageId) : 'No disponible';

    const mensaje =
        `📬 <b>FEEDBACK RECIBIDO</b>\n\n` +
        `👤 <b>Usuario:</b> ${nombre} (ID: <code>${usuario.id}</code>)\n` +
        `📝 <b>Feedback:</b> "${esc(textoFeedback)}"\n\n` +
        `🔗 <b>Enlace al mensaje:</b> ${enlaceMensaje}`;

    await notificarCreador(telegram, mensaje);
}

// ==================== EXPORTS ====================
module.exports = {
    notificarAdministradores,
    notificarCreador,
    notificarEnlaceProhibido,
    notificarContenidoProhibido,
    notificarAvisoComando,
    notificarAvisoEnlaceCreador,
    notificarAvisoContenidoCreador,
    notificarFeedbackNegativo,
    construirEnlaceMensaje
};