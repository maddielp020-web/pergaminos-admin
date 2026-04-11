// ==================== FILTRO_ENLACES ====================
const DOMINIOS_PERMITIDOS = [
    'gutenberg.org',
    'openlibrary.org',
    'archive.org',
    't.me/PergaminosLibros_Bot',
    't.me/PergaminosAdmin_Bot',
    't.me/PergaminosAbiertosChannel',
    't.me/+bCKN6JnABA8xZGM6'
];

// ==================== FUNCIONES ====================
function esEnlacePermitido(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return DOMINIOS_PERMITIDOS.some(dominio => urlLower.includes(dominio));
}

function contieneEnlaceEnTexto(texto) {
    if (!texto) return false;
    const patrones = [
        /https?:\/\/[^\s]+/gi,
        /t\.me\/[^\s]+/gi,
        /telegram\.me\/[^\s]+/gi
    ];
    return patrones.some(p => p.test(texto));
}

function extraerEnlacesDeTexto(texto) {
    if (!texto) return [];
    const patron = /(https?:\/\/[^\s]+|t\.me\/[^\s]+|telegram\.me\/[^\s]+)/gi;
    return texto.match(patron) || [];
}

function extraerEnlacesDeTexto(texto) {
    if (!texto) return [];
    const patron = /(https?:\/\/[^\s]+|t\.me\/[^\s]+|telegram\.me\/[^\s]+)/gi;
    return texto.match(patron) || [];
}

// FIX: extraer enlaces ocultos en entidades de Telegram (links embebidos en texto visible)
function extraerEnlacesDeEntidades(entidades) {
    if (!entidades || entidades.length === 0) return [];
    const urls = [];
    for (const entidad of entidades) {
        // type 'url' = enlace visible, type 'text_link' = enlace oculto detrás de texto
        if (entidad.type === 'url' && entidad.url) urls.push(entidad.url);
        if (entidad.type === 'text_link' && entidad.url) urls.push(entidad.url);
    }
    return urls;
}

async function filtrarMensaje(ctx) {
    const mensaje = ctx.message;
    if (!mensaje) return { eliminado: false };

    // FIX: revisar tanto message.text como message.caption (fotos/videos con texto)
    const texto = mensaje.text || mensaje.caption || '';
    // FIX: revisar entidades de texto y de caption
    const entidades = mensaje.entities || mensaje.caption_entities || [];

    const usuario = mensaje.from;
    const messageId = mensaje.message_id;

    // Recopilar todos los enlaces: del texto plano + entidades ocultas
    const enlacesTexto = extraerEnlacesDeTexto(texto);
    const enlacesEntidades = extraerEnlacesDeEntidades(entidades);

    // FIX: también detectar si hay entidad tipo url/text_link aunque el texto no lo muestre
    const hayEnlaceOculto = entidades.some(e => e.type === 'url' || e.type === 'text_link' || e.type === 'mention');
    const hayEnlaceEnTexto = contieneEnlaceEnTexto(texto);

    if (!hayEnlaceEnTexto && !hayEnlaceOculto) {
        return { eliminado: false };
    }

    // Unir todos los enlaces encontrados y filtrar los no permitidos
    const todosLosEnlaces = [...new Set([...enlacesTexto, ...enlacesEntidades])];
    const enlacesNoPermitidos = todosLosEnlaces.filter(e => !esEnlacePermitido(e));

    // Si todos los enlaces son de dominios permitidos, dejar pasar
    if (todosLosEnlaces.length > 0 && enlacesNoPermitidos.length === 0) {
        return { eliminado: false };
    }

    // Si hay enlace oculto sin URL recuperable, marcarlo igual
    const motivoEliminacion = enlacesNoPermitidos.length > 0
        ? enlacesNoPermitidos
        : ['[enlace oculto detectado en entidades]'];

    // Eliminar mensaje
    try {
        await ctx.deleteMessage(messageId);
        console.log(`🗑️ Mensaje eliminado por enlace no permitido: usuario ${usuario.id}`);
    } catch (error) {
        console.error(`❌ Error al eliminar mensaje: ${error.message}`);
    }

    return {
        eliminado: true,
        razon: 'enlaces_no_permitidos',
        enlaces: motivoEliminacion,
        usuario,
        chatId: mensaje.chat.id
    };
}

// ==================== EXPORTS ====================
module.exports = {
    esEnlacePermitido,
    contieneEnlaceEnTexto,
    extraerEnlacesDeTexto,
    filtrarMensaje
};