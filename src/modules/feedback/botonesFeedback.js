// ==================== FEEDBACK_BOTONES ====================
// NOTA IMPORTANTE — LIMITACIÓN DE TELEGRAM:
// Telegram NO entrega mensajes de bots a otros bots en long polling.
// Por eso el feedback NO puede activarse automáticamente al detectar
// mensajes de @PergaminosLibros_Bot.
//
// SOLUCIÓN IMPLEMENTADA:
// El usuario activa el feedback manualmente con el comando /feedback
// después de hacer una búsqueda. El bot le pregunta si el resultado
// fue útil y notifica al admin si es negativo.
// ================================================================

const { notificarFeedbackNegativo } = require('../../utils/notificaciones');

// Almacena temporalmente el contexto de feedback por usuario (en memoria)
const feedbackPendiente = new Map();

// ==================== FUNCIONES ====================

/**
 * Inicia el flujo de feedback cuando el usuario escribe /feedback
 * Se registra el contexto y se muestran los botones 👍/👎
 */
async function iniciarFeedback(ctx) {
    const usuarioId = ctx.from.id;
    const nombre = ctx.from.first_name || 'Usuario';

    // Guardar contexto básico (no tenemos acceso al mensaje del otro bot)
    feedbackPendiente.set(usuarioId, {
        timestamp: Date.now(),
        nombre
    });

    await ctx.reply(
        `📬 *¿Fue útil el último resultado de búsqueda?*\n\n` +
        `Toca uno de los botones para darnos tu opinión:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '👍 Sí, me sirvió', callback_data: `fb_pos_${usuarioId}` },
                    { text: '👎 No me sirvió', callback_data: `fb_neg_${usuarioId}` }
                ]]
            }
        }
    );
}

/**
 * Maneja el callback de feedback positivo (👍)
 */
async function manejarFeedbackPositivo(ctx) {
    const usuarioId = ctx.from.id;
    feedbackPendiente.delete(usuarioId);

    await ctx.answerCbQuery('¡Gracias! Nos alegra que te haya sido útil. 😊');

    try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch (_) {}

    await ctx.reply('✅ ¡Gracias por tu feedback! Seguimos mejorando para ti.');
}

/**
 * Maneja el callback de feedback negativo (👎)
 * Notifica al administrador con el contexto disponible
 */
async function manejarFeedbackNegativo(ctx) {
    const usuarioId = ctx.from.id;
    const usuario = ctx.from;
    const pendiente = feedbackPendiente.get(usuarioId);

    feedbackPendiente.delete(usuarioId);

    await ctx.answerCbQuery('Gracias por avisarnos. Lo revisaremos. 🙏');

    try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch (_) {}

    await ctx.reply(
        '📝 Gracias por tu feedback negativo.\n\n' +
        'Si quieres explicarnos qué falló, escríbelo aquí y se lo haremos llegar al equipo.\n\n' +
        '_Puedes ignorar este mensaje si no quieres agregar nada._',
        { parse_mode: 'Markdown' }
    );

    // Notificar al admin
    const contexto = pendiente
        ? `Usuario ${pendiente.nombre} reportó resultado negativo`
        : `Usuario ${usuario.first_name || usuario.id} reportó resultado negativo`;

    await notificarFeedbackNegativo(ctx.telegram, usuario, contexto);
}

/**
 * Limpieza periódica de feedbacks pendientes sin respuesta (30 min)
 */
setInterval(() => {
    const ahora = Date.now();
    for (const [id, f] of feedbackPendiente) {
        if (ahora - f.timestamp > 30 * 60 * 1000) {
            feedbackPendiente.delete(id);
        }
    }
}, 10 * 60 * 1000);

// ==================== EXPORTS ====================
module.exports = {
    iniciarFeedback,
    manejarFeedbackPositivo,
    manejarFeedbackNegativo
};