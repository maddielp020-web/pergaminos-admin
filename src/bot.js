// ==================== IMPORTACIONES ====================
const { Telegraf } = require('telegraf');
const { BOT_TOKEN, ADMIN_IDS, CREATEDOR_ID } = require('./config');
const { filtrarMensaje: filtrarEnlaces, ENLACES_OFICIALES } = require('./modules/disciplina/filtroEnlaces');
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
    notificarAvisoEnlaceCreadorNoOficial,
    notificarAvisoContenidoCreador,
    notificarAdminEnlaceProhibido,
    notificarInfraccion1,
    notificarInfraccion2,
    notificarInfraccion3Publico,
    notificarInfraccion3Privado,
    notificarInfraccion4Publico,
    notificarInfraccion4Privado,
    notificarCreadorSuspension,
    notificarCreadorExpulsion,
    construirEnlaceMensaje
} = require('./utils/notificaciones');
const { esAdminDelGrupo } = require('./utils/cacheAdmins');
const { puedeEnviarAviso } = require('./modules/disciplina/rateLimit');
const { 
    registrarInfraccion, 
    obtenerInfracciones,
    estaSuspendido 
} = require('./modules/disciplina/contadorInfracciones');

// ==================== CONFIGURACION ====================
const bot = new Telegraf(BOT_TOKEN);

console.log('🛡️ PergaminosAdmin_Bot - Guardián del grupo');
console.log(`👑 Creador: ${CREATEDOR_ID}`);
console.log(`🛡️ Admins adicionales: ${ADMIN_IDS.filter(id => id !== CREATEDOR_ID).join(', ') || 'ninguno'}`);

// ==================== MENSAJE_REDIRECCION_PRIVADO ====================
const MENSAJE_REDIRECCION = `🛡️ El guardián levanta la vista.

Trabajo dentro del grupo PergaminosAbiertos. Allí escucho, guío y protejo el silencio de la biblioteca.

🏛️ Únete al grupo y escríbeme allí:
🔗 https://t.me/Pergaminos_Abiertos

Allí también te espera el bibliotecario @PergaminosLibros_Bot para buscar los libros que deseas.

🕯️ El guardián siempre escucha.`;

// ==================== MIDDLEWARE_CHAT_PRIVADO ====================
bot.use(async (ctx, next) => {
    const chatType = ctx.chat?.type;
    const userId = ctx.from?.id;

    // Solo aplicar en chats privados
    if (chatType !== 'private') {
        return next();
    }

    // Si es el creador, permitir todo
    if (userId === CREATEDOR_ID) {
        console.log(`👑 Creador en privado - acceso permitido`);
        return next();
    }

    // Cualquier otro usuario: redirigir y NO procesar más
    console.log(`🚫 Usuario ${userId} intentó usar el bot en privado - redirigido`);
    await ctx.reply(MENSAJE_REDIRECCION);
    // No llamar a next() - el mensaje se ignora completamente
});

// ==================== HELPERS ====================
function esComandoBot(mensaje) {
    if (!mensaje || !mensaje.entities) return false;
    return mensaje.entities.some(e => e.type === 'bot_command');
}

function esCreador(userId) {
    return userId === CREATEDOR_ID;
}

function esAdminSinFiltro(userId) {
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
// ... (todo el código existente del middleware de disciplina se mantiene IGUAL) ...

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
        const username = usuario.username || usuario.first_name;
        const enlaceMensaje = construirEnlaceMensaje(ctx.chat.id, mensaje.message_id);
        const enlace = resultadoEnlaces.enlaces[0] || 'enlace detectado';
        
        // ===== CASO 1: CREADOR CON ENLACE NO OFICIAL =====
        if (esCreadorUsuario && resultadoEnlaces.razon === 'enlace_no_oficial_creador') {
            await notificarAvisoEnlaceCreadorNoOficial(
                ctx.telegram,
                ctx.chat.id,
                mensaje.message_id,
                usuario,
                resultadoEnlaces.enlaces
            );
            console.log(`📢 Aviso al creador por enlace NO oficial - mensaje eliminado`);
            return;
        }
        
        // ===== CASO 2: ADMIN HUMANO (NO CREADOR) =====
        const esAdmin = await esAdminDelGrupo(ctx.telegram, ctx.chat.id, userId);
        if (esAdmin && !esCreadorUsuario) {
            await notificarAdminEnlaceProhibido(
                ctx.telegram,
                userId,
                enlace,
                username
            );
            console.log(`📢 Aviso a admin ${userId} por enlace no permitido`);
            return;
        }
        
        // ===== CASO 3: USUARIO NORMAL - SISTEMA DE INFRACCIONES =====
        if (!esAdmin && !esCreadorUsuario) {
            // Verificar si ya está suspendido
            if (estaSuspendido(userId)) {
                console.log(`⏸️ Usuario ${userId} está suspendido - mensaje eliminado sin aviso adicional`);
                return;
            }
            
            // Registrar infracción
            const resultado = registrarInfraccion(userId);
            const infracciones = resultado.infracciones;
            
            switch (infracciones) {
                case 1:
                    await notificarInfraccion1(ctx.telegram, ctx.chat.id, username);
                    break;
                    
                case 2:
                    await notificarInfraccion2(ctx.telegram, ctx.chat.id, username);
                    break;
                    
                case 3:
                    // Suspensión 12h
                    try {
                        await ctx.telegram.banChatMember(
                            ctx.chat.id,
                            userId,
                            { until_date: Math.floor(Date.now() / 1000) + 12 * 60 * 60 }
                        );
                    } catch (error) {
                        console.error(`❌ Error al suspender usuario ${userId}: ${error.message}`);
                    }
                    
                    await notificarInfraccion3Publico(ctx.telegram, ctx.chat.id, username);
                    await notificarInfraccion3Privado(ctx.telegram, userId, username);
                    await notificarCreadorSuspension(
                        ctx.telegram,
                        CREATEDOR_ID,
                        username,
                        userId,
                        enlaceMensaje
                    );
                    break;
                    
                case 4:
                    // Expulsión permanente
                    try {
                        await ctx.telegram.banChatMember(ctx.chat.id, userId);
                    } catch (error) {
                        console.error(`❌ Error al expulsar usuario ${userId}: ${error.message}`);
                    }
                    
                    await notificarInfraccion4Publico(ctx.telegram, ctx.chat.id, username);
                    await notificarInfraccion4Privado(ctx.telegram, userId, username);
                    await notificarCreadorExpulsion(
                        ctx.telegram,
                        CREATEDOR_ID,
                        username,
                        userId,
                        enlaceMensaje
                    );
                    break;
            }
            
            console.log(`📊 Usuario ${userId} - Infracción #${infracciones} por enlace no permitido`);
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

return next();
});

// ==================== HANDLER_START ====================
bot.command('start', async (ctx) => {
    const chatType = ctx.chat?.type;
    const userId = ctx.from?.id;
    
    // Solo responder en chat privado Y solo al creador
    if (chatType === 'private' && userId === CREATEDOR_ID) {
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
    }
    // En el grupo o en privado sin ser creador: NO RESPONDER
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
bot.command('feedback', iniciarFeedback);

// ==================== CALLBACKS_FEEDBACK ====================
bot.action(/^fb_pos_/, manejarFeedbackPositivo);
bot.action(/^fb_neg_/, manejarFeedbackNegativo);

// ==================== EXPORTS ====================
module.exports = bot;