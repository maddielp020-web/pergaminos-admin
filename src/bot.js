// ==================== IMPORTACIONES ====================
const { Telegraf } = require('telegraf');
const { BOT_TOKEN, ADMIN_IDS } = require('./config');
const { filtrarMensaje } = require('./modules/disciplina/filtroEnlaces');
const { filtrarMensajePorContenido } = require('./modules/disciplina/palabrasProhibidas');
const { iniciarFeedback, manejarFeedbackPositivo, manejarFeedbackNegativo } = require('./modules/feedback/botonesFeedback');
const { notificarEnlaceProhibido, notificarContenidoProhibido } = require('./utils/notificaciones');
const { esAdminDelGrupo } = require('./utils/cacheAdmins');

// ==================== CONFIGURACION ====================
const bot = new Telegraf(BOT_TOKEN);

console.log('🛡️ PergaminosAdmin_Bot - Guardián del grupo');
console.log(`👑 Administradores: ${ADMIN_IDS.join(', ')}`);

// ==================== HELPER: AVISO TEMPORAL ====================
// FIX: avisar al usuario cuando su mensaje es eliminado, y borrar el aviso después de 8s
async function avisarYBorrar(ctx, texto) {
    try {
        const aviso = await ctx.reply(texto);
        setTimeout(async () => {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, aviso.message_id);
            } catch (_) {}
        }, 8000);
    } catch (_) {}
}

// ==================== MIDDLEWARE_DISCIPLINA ====================
bot.use(async (ctx, next) => {
    const chatType = ctx.chat?.type;

    // Solo actuar en grupos y supergrupos
    if (chatType !== 'group' && chatType !== 'supergroup') {
        return next();
    }

    const mensaje = ctx.message;
    if (!mensaje) return next();

    const usuario = mensaje.from;

    // FIX: usar cache para verificar admin — evita rate limit con muchos mensajes
    const esAdmin = await esAdminDelGrupo(ctx.telegram, ctx.chat.id, usuario.id);
    if (esAdmin) return next();

    // 1. FILTRO DE ENLACES (incluye entidades ocultas y captions)
    const resultadoEnlaces = await filtrarMensaje(ctx);
    if (resultadoEnlaces.eliminado) {
        await notificarEnlaceProhibido(
            ctx.telegram,
            resultadoEnlaces.usuario,
            resultadoEnlaces.enlaces
        );
        // FIX: avisar al usuario en lugar de silencio total
        await avisarYBorrar(ctx,
            `⚠️ ${usuario.first_name}, tu mensaje fue eliminado por contener enlaces no permitidos en este grupo.`
        );
        return;
    }

    // 2. FILTRO DE PALABRAS Y EMOJIS PROHIBIDOS
    const resultadoContenido = await filtrarMensajePorContenido(ctx);
    if (resultadoContenido.eliminado) {
        await notificarContenidoProhibido(
            ctx.telegram,
            resultadoContenido.usuario,
            resultadoContenido.palabras,
            resultadoContenido.emojis
        );
        // FIX: avisar al usuario
        await avisarYBorrar(ctx,
            `⚠️ ${usuario.first_name}, tu mensaje fue eliminado por contener contenido no permitido en este grupo.`
        );
        return;
    }

    return next();
});

// ==================== HANDLER_START ====================
bot.command('start', async (ctx) => {
    await ctx.reply(
        '🛡️ <b>PergaminosAdmin_Bot</b>\n\n' +
        'Soy el guardián del grupo PergaminosAbiertos.\n\n' +
        '<b>Mis funciones:</b>\n' +
        '• Elimino enlaces no permitidos\n' +
        '• Elimino palabras y emojis prohibidos\n' +
        '• Recibo feedback sobre los resultados de búsqueda\n\n' +
        '<b>Comandos disponibles:</b>\n' +
        '/feedback — ¿Te fue útil la última búsqueda?\n' +
        '/ayuda — Ver esta ayuda',
        { parse_mode: 'HTML' }
    );
});

// ==================== HANDLER_AYUDA ====================
bot.command('ayuda', async (ctx) => {
    await ctx.reply(
        '📘 <b>AYUDA — PergaminosAdmin_Bot</b>\n\n' +
        '<b>¿Qué hace este bot?</b>\n' +
        'Mantiene el orden en el grupo eliminando automáticamente:\n' +
        '• Enlaces a sitios no permitidos\n' +
        '• Palabras y emojis inapropiados\n\n' +
        '<b>Comandos para usuarios:</b>\n' +
        '/feedback — Indicar si el resultado de búsqueda fue útil\n\n' +
        '<b>¿Mi mensaje fue eliminado?</b>\n' +
        'Solo se permiten enlaces a: gutenberg.org, openlibrary.org y archive.org.',
        { parse_mode: 'HTML' }
    );
});

// ==================== HANDLER_FEEDBACK ====================
// FIX: el feedback lo inicia el usuario con /feedback
// porque Telegram no entrega mensajes de bots a otros bots
bot.command('feedback', iniciarFeedback);

// ==================== CALLBACKS_FEEDBACK ====================
bot.action(/^fb_pos_/, manejarFeedbackPositivo);
bot.action(/^fb_neg_/, manejarFeedbackNegativo);

// ==================== EXPORTS ====================
module.exports = bot;