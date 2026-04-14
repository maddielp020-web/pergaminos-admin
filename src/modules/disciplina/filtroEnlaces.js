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

// ==================== ENLACES_OFICIALES_CREADOR ====================
// Estos enlaces NUNCA se borran si los publica el creador
// Coincidencia EXACTA, no subcadenas
const ENLACES_OFICIALES = [
    'https://t.me/Pergaminos_Abiertos',
    'https://t.me/Pergaminos_Channel',
    'https://t.me/PergaminosLibros_Bot',
    'https://t.me/PergaminosAdmin_Bot'
];

// ==================== FUNCIONES ====================
function esEnlacePermitido(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return DOMINIOS_PERMITIDOS.some(dominio => urlLower.includes(dominio));
}

function esEnlaceOficialCreador(url) {
    if (!url) return false;
    // Coincidencia EXACTA
    return ENLACES_OFICIALES.some(enlace => url === enlace);
}

// ... resto de funciones existentes (contieneEnlaceEnTexto, extraerEnlacesDeTexto, extraerEnlacesDeEntidades) se mantienen IGUAL ...

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

    const texto = mensaje.text || mensaje.caption || '';
    const entidades = mensaje.entities || mensaje.caption_entities || [];

    const usuario = mensaje.from;
    const userId = usuario.id;
    const messageId = mensaje.message_id;
    const chatId = mensaje.chat.id;

    // Recopilar todos los enlaces
    const enlacesTexto = extraerEnlacesDeTexto(texto);
    const enlacesEntidades = extraerEnlacesDeEntidades(entidades);
    const todosLosEnlaces = [...new Set([...enlacesTexto, ...enlacesEntidades])];

    const hayEnlaceOculto = entidades.some(e => e.type === 'url' || e.type === 'text_link');
    const hayEnlaceEnTexto = contieneEnlaceEnTexto(texto);

    if (!hayEnlaceEnTexto && !hayEnlaceOculto) {
        return { eliminado: false };
    }

    // ========== LÓGICA ESPECIAL PARA EL CREADOR ==========
    const CREADOR_ID = 2022025893;
    const esCreador = userId === CREADOR_ID;

    if (esCreador && todosLosEnlaces.length > 0) {
        // Verificar si TODOS los enlaces son oficiales (coincidencia exacta)
        const todosSonOficiales = todosLosEnlaces.every(enlace => esEnlaceOficialCreador(enlace));
        
        if (todosSonOficiales) {
            // Enlaces oficiales: NO borrar, NO avisar
            console.log(`✅ Creador publicó enlace oficial - permitido`);
            return { eliminado: false };
        }
        
        // Hay enlaces NO oficiales: borrar y marcar para aviso especial
        const enlacesNoOficiales = todosLosEnlaces.filter(enlace => !esEnlaceOficialCreador(enlace));
        
        try {
            await ctx.deleteMessage(messageId);
            console.log(`🗑️ Mensaje del creador eliminado por enlace NO oficial`);
        } catch (error) {
            console.error(`❌ Error al eliminar mensaje del creador: ${error.message}`);
        }
        
        return {
            eliminado: true,
            razon: 'enlace_no_oficial_creador',
            enlaces: enlacesNoOficiales,
            usuario,
            chatId
        };
    }

    // ========== LÓGICA PARA USUARIOS NORMALES ==========
    const enlacesNoPermitidos = todosLosEnlaces.filter(e => !esEnlacePermitido(e));

    // Si todos los enlaces son de dominios permitidos, dejar pasar
    if (todosLosEnlaces.length > 0 && enlacesNoPermitidos.length === 0) {
        return { eliminado: false };
    }

    const motivoEliminacion = enlacesNoPermitidos.length > 0
        ? enlacesNoPermitidos
        : ['[enlace oculto detectado en entidades]'];

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
        chatId
    };
}

// ==================== EXPORTS ====================
module.exports = {
    esEnlacePermitido,
    contieneEnlaceEnTexto,
    extraerEnlacesDeTexto,
    filtrarMensaje
};