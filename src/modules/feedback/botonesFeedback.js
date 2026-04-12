// ==================== FEEDBACK_BOTONES ====================
const { notificarFeedbackNegativo } = require('../../utils/notificaciones');

// Almacena temporalmente el contexto de feedback por usuario
const feedbackPendiente = new Map();

// ==================== FUNCIONES ====================
async function iniciarFeedback(ctx) {
    const usuarioId = ctx.from.id;
    const nombre = ctx.from.first_name || 'Usuario';
    
    const mensajeCompleto = ctx.message.text || '';
    const textoFeedback = mensajeCompleto.replace(/^\/feedback\s*/, '').trim();

    feedbackPendiente.set(usuarioId, {
        timestamp: Date.now(),
        nombre,
        textoFeedback: textoFeedback || '(sin texto adicional)',
        messageId: ctx.message.message_id,
        chatId: ctx.chat.id
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

async function manejarFeedbackPositivo(ctx) {
    const usuarioId = ctx.from.id;
    feedbackPendiente.delete(usuarioId);

    await ctx.answerCbQuery('¡Gracias! Nos alegra que te haya sido útil. 😊');

    try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch (_) {}

    await ctx.reply('✅ ¡Gracias por tu feedback! Seguimos mejorando para ti.');
}

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

    if (pendiente) {
        await notificarFeedbackNegativo(
            ctx.telegram,
            usuario,
            pendiente.textoFeedback,
            pendiente.messageId,
            pendiente.chatId
        );
    } else {
        await notificarFeedbackNegativo(
            ctx.telegram,
            usuario,
            '(Feedback sin contexto guardado)',
            null,
            null
        );
    }
}

// ==================== LIMPIEZA_PERIODICA ====================
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