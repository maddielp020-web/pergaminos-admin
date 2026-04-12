// ==================== FILTRO_PALABRAS ====================
const PALABRAS_PROHIBIDAS = [
    'puta', 'puto', 'mierda', 'joder', 'cono', 'cabron', 'cabrona',
    'pendejo', 'pendeja', 'idiota', 'estupido', 'estupida',
    'imbecil', 'maldito', 'maldita',
    'spam', 'estafa', 'fraude',
    'odio', 'muerte', 'matar', 'violar'
];

const EMOJIS_PROHIBIDOS = [
    '🔞', '🍆', '🍑', '💦', '👅', '🖕', '👊', '🤬', '💀', '☠️'
];

// ==================== HELPER ====================
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.toLowerCase()
        .replace(/[áàä]/g, 'a')
        .replace(/[éèë]/g, 'e')
        .replace(/[íìï]/g, 'i')
        .replace(/[óòö]/g, 'o')
        .replace(/[úùü]/g, 'u')
        .replace(/ñ/g, 'n');
}

// ==================== FUNCIONES ====================
function contienePalabraProhibida(texto) {
    if (!texto) return { contiene: false, palabras: [] };

    const textoNorm = normalizarTexto(texto);
    
    const palabrasEncontradas = PALABRAS_PROHIBIDAS.filter(p => {
        const palabraNorm = normalizarTexto(p);
        // Usar regex con límites de palabra para detectar palabra completa
        const regex = new RegExp(`\\b${palabraNorm}\\b`, 'i');
        return regex.test(textoNorm);
    });

    return {
        contiene: palabrasEncontradas.length > 0,
        palabras: palabrasEncontradas
    };
}

function contieneEmojiProhibido(texto) {
    if (!texto) return { contiene: false, emojis: [] };

    const emojisEncontrados = EMOJIS_PROHIBIDOS.filter(e => texto.includes(e));

    return {
        contiene: emojisEncontrados.length > 0,
        emojis: emojisEncontrados
    };
}

async function filtrarMensajePorContenido(ctx) {
    const mensaje = ctx.message;
    if (!mensaje) return { eliminado: false };

    // FIX: revisar texto y caption (fotos/videos)
    const texto = mensaje.text || mensaje.caption || '';
    if (!texto) return { eliminado: false };

    const usuario = mensaje.from;
    const messageId = mensaje.message_id;

    const resultadoPalabras = contienePalabraProhibida(texto);
    const resultadoEmojis = contieneEmojiProhibido(texto);

    if (!resultadoPalabras.contiene && !resultadoEmojis.contiene) {
        return { eliminado: false };
    }

    try {
        await ctx.deleteMessage(messageId);
        console.log(`🗑️ Mensaje eliminado por contenido prohibido: usuario ${usuario.id}`);
    } catch (error) {
        console.error(`❌ Error al eliminar mensaje: ${error.message}`);
    }

    return {
        eliminado: true,
        razon: 'contenido_prohibido',
        palabras: resultadoPalabras.palabras,
        emojis: resultadoEmojis.emojis,
        usuario,
        chatId: mensaje.chat.id
    };
}

// ==================== EXPORTS ====================
module.exports = {
    contienePalabraProhibida,
    contieneEmojiProhibido,
    filtrarMensajePorContenido,
    PALABRAS_PROHIBIDAS,
    EMOJIS_PROHIBIDOS
};