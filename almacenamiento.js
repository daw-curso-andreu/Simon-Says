// Persistencia: localStorage (jugador, récord, historial) + MockAPI (ranking global)
const MOCKAPI_URL = 'https://6ae856301a7b15aaa50ef0e1.mockapi.io/SimonSays/partidas'
const CLAVE_PARTIDAS = 'simon_partidas'
const CLAVE_JUGADOR = 'simon_jugador'
const CLAVE_TOP = 'simon_topscore'

// ---------- localStorage (con protección por si no está disponible) ----------
function leerLocal(clave, defecto) {
    try {
        return JSON.parse(localStorage.getItem(clave)) ?? defecto
    } catch {
        return defecto
    }
}

function escribirLocal(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor))
    } catch {
        console.warn('localStorage no disponible')
    }
}

const obtenerJugador = () => leerLocal(CLAVE_JUGADOR, null)
const obtenerTopScore = () => Number(leerLocal(CLAVE_TOP, 0)) || 0
const guardarTopScore = puntos => escribirLocal(CLAVE_TOP, puntos)

async function pedirJugador() {
    if (obtenerJugador()) return
    const valor = await swal({
        title: '¿Cómo te llamas?',
        text: 'Tu nombre aparecerá en el ranking.',
        content: { element: 'input', attributes: { placeholder: 'Tu nombre', maxLength: 20 } },
        button: 'Jugar',
        closeOnClickOutside: false,
        closeOnEsc: false,
    })
    escribirLocal(CLAVE_JUGADOR, (valor || '').trim().slice(0, 20) || 'Anónimo')
}

// ---------- MockAPI ----------
const peticion = (url, opciones) => fetch(url, { ...opciones, signal: AbortSignal.timeout(5000) })

// Guarda la partida en local y la envía a MockAPI (si falla, se reintenta en la siguiente)
async function guardarPartida(datos) {
    const partida = { ...datos, fecha: new Date().toISOString(), sincronizada: false }
    escribirLocal(CLAVE_PARTIDAS, [...leerLocal(CLAVE_PARTIDAS, []), partida])
    await sincronizarPartidas()
}

let sincronizando = false

async function sincronizarPartidas() {
    if (sincronizando) return
    sincronizando = true
    const enviadas = new Set()
    try {
        for (const { sincronizada, ...datos } of leerLocal(CLAVE_PARTIDAS, []).filter(p => !p.sincronizada)) {
            const respuesta = await peticion(MOCKAPI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos),
            })
            if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status)
            enviadas.add(datos.fecha)
        }
    } catch (e) {
        console.warn('MockAPI no disponible, se reintentará más tarde', e)
    }
    escribirLocal(CLAVE_PARTIDAS, leerLocal(CLAVE_PARTIDAS, []).map(p => (enviadas.has(p.fecha) ? { ...p, sincronizada: true } : p)))
    sincronizando = false
}

// Partidas de MockAPI + las locales aún sin enviar (o solo las locales si falla)
async function obtenerPartidas() {
    await sincronizarPartidas()
    const locales = leerLocal(CLAVE_PARTIDAS, [])
    try {
        const respuesta = await peticion(MOCKAPI_URL)
        if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status)
        const pendientes = locales.filter(p => !p.sincronizada)
        return { partidas: [...(await respuesta.json()), ...pendientes], origen: 'MockAPI' }
    } catch (e) {
        console.warn('No se pudo leer MockAPI, se usan los datos locales', e)
        return { partidas: locales, origen: 'este navegador (localStorage)' }
    }
}

// ---------- Ranking e informes ----------
const esc = texto => String(texto).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`) // evita inyectar HTML desde la API

function informe(titulo, partidas) {
    const puntos = partidas.map(p => Number(p.puntuacion) || 0)
    const media = puntos.length ? Math.round(puntos.reduce((a, b) => a + b, 0) / puntos.length) : 0
    return `<h3>${esc(titulo)}</h3><ul>
        <li>Partidas jugadas: ${partidas.length}</li>
        <li>Victorias: ${partidas.filter(p => p.resultado === 'victoria').length}</li>
        <li>Mejor puntuación: ${Math.max(0, ...puntos)}</li>
        <li>Puntuación media: ${media}</li>
        <li>Nivel más alto: ${Math.max(0, ...partidas.map(p => Number(p.nivel) || 0))}</li></ul>`
}

function tablaRanking(partidas) {
    const filas = [...partidas]
        .sort((a, b) => (Number(b.puntuacion) || 0) - (Number(a.puntuacion) || 0))
        .slice(0, 10)
        .map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.jugador || 'Anónimo')}</td><td>${esc(p.puntuacion)}</td>
            <td>${esc(p.nivel)}</td><td>${p.resultado === 'victoria' ? 'Victoria' : 'Derrota'}</td></tr>`)
        .join('')
    return `<table class="ranking"><tr><th>#</th><th>Jugador</th><th>Puntos</th><th>Nivel</th><th>Resultado</th></tr>
        ${filas || '<tr><td colspan="5">Todavía no hay partidas</td></tr>'}</table>`
}

async function mostrarRanking() {
    const { partidas, origen } = await obtenerPartidas()
    const jugador = obtenerJugador() || 'Anónimo'

    const panel = document.createElement('div')
    panel.className = 'panel-ranking'
    panel.innerHTML = `<h3>Top 10</h3>${tablaRanking(partidas)}
        ${informe('Informe de ' + jugador, partidas.filter(p => p.jugador === jugador))}
        ${informe('Informe global', partidas)}
        <p class="origen">Datos de ${origen}</p>`

    const cerrar = await swal({
        title: 'Ranking e informes',
        content: panel,
        buttons: ['Cambiar jugador', 'Cerrar'],
        closeOnClickOutside: false,
        closeOnEsc: false,
    })
    if (!cerrar) {
        try { localStorage.removeItem(CLAVE_JUGADOR) } catch { /* sin localStorage */ }
        await pedirJugador()
    }
}
