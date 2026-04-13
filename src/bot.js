// ==================== IMPORTACIONES ====================
const { Telegraf } = require('telegraf');
const { BOT_TOKEN, ADMIN_IDS, CREATEDOR_ID } = require('./config');
const { filtrarMensaje: filtrarEnlaces } = require('./modules/disciplina/filtroEnlaces');
const { 
    filtrarMensajePorContenido, 
    contienePalabraParaAviso,
    contienePalabraProhibida,
    contieneEmojiProhibido
} = require('./modules/disciplina/palabrasProhibidas');
const { iniciarFeedback, manejarFeedbackPositivo, manejarFeedbackNegativo } = require('./modules/feedback/botonesFeedback');
const { 
    notificarEnlaceProhibido, 
    notificarContenidoProhibido, 
    notificarAvisoComando,
    notificarAvisoEnlaceCreador,
    notificarAvisoContenidoCreador
} = require('./utils/notificaciones');
const { esAdminDelGrupo } = require('./utils/cacheAdmins');
const { puedeEnviarAviso } = require('./modules/disciplina/rateLimit');

// ==================== CONFIGURACION ====================
const bot = new Telegraf(BOT_TOKEN);

console.log('🛡️ PergaminosAdmin_Bot - Guardián del grupo');
console.log(`👑 Creador: ${CREATEDOR_ID}`);
console.log(`🛡️ Admins adicionales: ${ADMIN_IDS.filter(id => id !== CREATEDOR_ID).join(', ') || 'ninguno'}`);

// ==================== HELPERS ====================
function esComandoBot(mensaje) {
    if (!mensaje || !mensaje.entities) return false;
    return mensaje.entities.some(e => e.type === 'bot_command');
}

function esCreador(userId) {
    return userId === CREATEDOR_ID;
}

function esAdminSinFiltro(userId) {
    // Es admin pero NO es el creador
    return ADMIN_IDS.includes(userId) && userId !== CREATEDOR_ID;
}

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

    if (chatType !== 'group' && chatType !== 'supergroup') {
        return next();
    }

    const mensaje = ctx.message;
    if (!mensaje) return next();

    const usuario = mensaje.from;
    const userId = usuario.id;
    const texto = mensaje.text || mensaje.caption || '';

    // ========== VERIFICACIÓN DE ADMIN (SIN FILTRO) ==========
    // Los admins que NO son el creador: sin filtro, sin avisos
    if (esAdminSinFiltro(userId)) {
        return next();
    }

    // Verificar si es admin del grupo (para otros admins no listados en ADMIN_IDS)
    const esAdminGrupo = await esAdminDelGrupo(ctx.telegram, ctx.chat.id, userId);
    if (esAdminGrupo && userId !== CREATEDOR_ID) {
        return next();
    }

    // ========== DETECCIÓN DE COMANDO ==========
    const esComando = esComandoBot(mensaje);
    const esComandoFeedback = texto.startsWith('/feedback');
    const esCreadorUsuario = esCreador(userId);

    // ========== CASO ESPECIAL: /feedback ==========
    if (esComandoFeedback) {
        // NUNCA se borra, independientemente de quién sea o qué contenga
        return next();
    }

    // ========== FILTRO DE ENLACES ==========
    const resultadoEnlaces = await filtrarEnlaces(ctx);
    if (resultadoEnlaces.eliminado) {
        if (esCreadorUsuario) {
            // Creador: no borrar, solo avisar
            await notificarAvisoEnlaceCreador(
                ctx.telegram,
                ctx.chat.id,
                mensaje.message_id,
                usuario,
                resultadoEnlaces.enlaces
            );
            console.log(`📢 Aviso al creador por su propio enlace no permitido`);
            return next();
        } else {
            // Usuario normal: borrar y notificar
            await notificarEnlaceProhibido(
                ctx.telegram,
                resultadoEnlaces.usuario,
                resultadoEnlaces.enlaces,
                false
            );
            await avisarYBorrar(ctx,
                `⚠️ ${usuario.first_name}, tu mensaje fue eliminado por contener enlaces no permitidos.`
            );
            return;
        }
    }

    // ========== SI ES COMANDO (que no sea /feedback) ==========
    if (esComando) {
        const resultadoAviso = contienePalabraParaAviso(texto);
        
        if (resultadoAviso.contiene && resultadoAviso.palabras.length > 0) {
            const puedeAvisar = puedeEnviarAviso(userId);
            
            if (puedeAvisar) {
                await notificarAvisoComando(
                    ctx.telegram,
                    ctx.chat.id,
                    mensaje.message_id,
                    usuario,
                    texto,
                    resultadoAviso.palabras[0],
                    esCreadorUsuario
                );
                console.log(`📢 Aviso por comando de ${usuario.id}: "${resultadoAviso.palabras[0]}"`);
            } else {
                console.log(`⏱️ Rate-limit alcanzado para usuario ${usuario.id}`);
            }
        }
        
        // Los comandos NUNCA se borran por contenido
        return next();
    }

   // ========== MENSAJE NORMAL (NO COMANDO) ==========
const resultadoPalabras = contienePalabraProhibida(texto);
const resultadoEmojis = contieneEmojiProhibido(texto);
const tieneContenidoProhibido = resultadoPalabras.contiene || resultadoEmojis.contiene;

if (tieneContenidoProhibido) {
    // Tanto creador como usuarios normales: borrar el mensaje
    // La única diferencia es el tipo de aviso que se envía
    console.log(`🗑️ Contenido prohibido detectado. Borrando mensaje...`);
    const resultadoContenido = await filtrarMensajePorContenido(ctx);
    
    if (resultadoContenido.eliminado) {
        if (esCreadorUsuario) {
            // Creador: aviso especial (pero el mensaje YA SE BORRÓ)
            await notificarAvisoContenidoCreador(
                ctx.telegram,
                ctx.chat.id,
                mensaje.message_id,
                usuario,
                resultadoPalabras.palabras,
                resultadoEmojis.emojis
            );
            console.log(`✅ Mensaje del creador borrado y aviso enviado.`);
        } else {
            // Usuario normal: aviso estándar + aviso temporal en el grupo
            await notificarContenidoProhibido(
                ctx.telegram,
                resultadoContenido.usuario,
                resultadoContenido.palabras,
                resultadoContenido.emojis,
                false
            );
            await avisarYBorrar(ctx,
                `⚠️ ${usuario.first_name}, tu mensaje fue eliminado por contener contenido no permitido.`
            );
            console.log(`✅ Mensaje de usuario normal borrado y notificaciones enviadas.`);
        }
        return;
    }
}

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
bot.command('feedback', iniciarFeedback);

// ==================== CALLBACKS_FEEDBACK ====================
bot.action(/^fb_pos_/, manejarFeedbackPositivo);
bot.action(/^fb_neg_/, manejarFeedbackNegativo);

// ==================== EXPORTS ====================
module.exports = bot;