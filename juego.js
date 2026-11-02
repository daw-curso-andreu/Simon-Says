const COLORES = [
  "azul",
  "rojo",
  "amarillo",
  "verde",
  "naranja",
  "morado",
  "rosa",
  "cian",
];
const LAST_LEVEL = 25;
const NIVEL_RAPIDO = 10; // desde este nivel el patrón va más rápido
const NIVEL_6_COLORES = 15; // desde este nivel hay 6 colores
const NIVEL_8_COLORES = 20; // desde este nivel hay 8 colores
const PAUSA_MAQUINA = 700; // espera (ms) antes de que juegue la máquina

const AVISOS = {
  [NIVEL_RAPIDO]: "¡La secuencia va más rápida!",
  [NIVEL_6_COLORES]: "¡Aparecen 2 colores nuevos: naranja y morado!",
  [NIVEL_8_COLORES]: "¡Aparecen 2 colores nuevos más: rosa y cian!",
};
const TEXTOS_TURNO = {
  maquina: "Observa la secuencia...",
  usuario: "¡Tu turno! Repite la secuencia",
  error: "¡Error!",
};

const $ = (id) => document.getElementById(id);
const tablero = $("tablero");
const estadoTurno = $("estado");
const btnEmpezar = $("btnEmpezar");
const elementos = Object.fromEntries(COLORES.map((c) => [c, $(c)]));

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const numColores = (nivel) =>
  nivel >= NIVEL_8_COLORES ? 8 : nivel >= NIVEL_6_COLORES ? 6 : 4;

let topScore = obtenerTopScore();
let juego;
$("top-score").textContent = "Puntuación Máxima: " + topScore;

class Juego {
  constructor() {
    this.level = 1;
    this.score = 0;
    this.secuencia = [];
    this.puedeJugar = false;
    tablero.onclick = (ev) => this.clic(ev.target.dataset.color);
    this.mostrarBoton(false);
    this.pintar();
    this.nextLevel();
  }

  // ---------- Pantalla ----------
  pintar() {
    if (this.score > topScore) {
      topScore = this.score;
      guardarTopScore(topScore);
    }
    $("level").textContent = "Nivel: " + this.level;
    $("score").textContent = "Puntuación: " + this.score;
    $("top-score").textContent = "Puntuación Máxima: " + topScore;
  }

  mostrarBoton(visible) {
    btnEmpezar.classList.toggle("show", visible);
    btnEmpezar.classList.toggle("hide", !visible);
  }

  // Colores visibles y velocidad según el nivel
  actualizarTablero() {
    const n = numColores(this.level);
    this.rapido = this.level >= NIVEL_RAPIDO;
    COLORES.forEach((c, i) => elementos[c].classList.toggle("oculto", i >= n));
    tablero.classList.toggle("colores-6", n === 6);
    tablero.classList.toggle("colores-8", n === 8);
    tablero.classList.toggle("rapido", this.rapido);
  }

  turno(estado) {
    this.puedeJugar = estado === "usuario";
    estadoTurno.textContent = TEXTOS_TURNO[estado] || "";
    estadoTurno.classList.toggle("error", estado === "error");
    tablero.classList.toggle("bloqueado", !this.puedeJugar);
  }

  encender(color) {
    const el = elementos[color];
    el.classList.add("light");
    setTimeout(() => el.classList.remove("light"), this.luz);
  }

  // ---------- Flujo del juego ----------
  nextLevel() {
    this.paso = 0;
    this.actualizarTablero();
    this.añadirColor();
    this.turno("maquina");

    const [intervalo, luz] = this.rapido ? [600, 200] : [1000, 350];
    this.luz = luz;
    setTimeout(() => {
      this.secuencia.forEach((color, i) =>
        setTimeout(() => this.encender(color), intervalo * i),
      );
      // el usuario no puede hacer clic hasta que la máquina termina
      setTimeout(
        () => this.turno("usuario"),
        intervalo * (this.level - 1) + luz + 200,
      );
    }, PAUSA_MAQUINA);
  }

  // Añade un color a la secuencia; si hay colores nuevos en este nivel, sale uno de ellos
  añadirColor() {
    const total = numColores(this.level);
    const desde =
      total > numColores(this.level - 1) ? numColores(this.level - 1) : 0;
    this.secuencia.push(
      COLORES[desde + Math.floor(Math.random() * (total - desde))],
    );
  }

  async clic(color) {
    if (!this.puedeJugar || !color) return;
    this.encender(color);
    if (color !== this.secuencia[this.paso]) return this.perder(color);

    this.paso++;
    this.score += 100;
    this.pintar();
    if (this.paso < this.level) return;

    // Nivel completado
    this.turno("");
    this.level++;
    if (this.level > LAST_LEVEL) return this.ganar();
    await swal({
      icon: "success",
      title: `Nivel ${this.level - 1} Completado`,
      text: AVISOS[this.level] || "",
      button: { text: `Seguir: Nivel ${this.level}` },
    });
    this.score += 500;
    this.pintar();
    this.nextLevel();
  }

  async perder(color) {
    this.turno("error");
    elementos[color].classList.add("error");
    this.guardar("derrota");
    await esperar(900);
    elementos[color].classList.remove("error");
    await swal({
      icon: "error",
      title: "Lo lamentamos Perdiste :(",
      text: "Perdiste",
      className: "swal-error",
    });
    this.reiniciar();
  }

  async ganar() {
    this.guardar("victoria");
    await swal({
      icon: "success",
      title: "Felicidades , ganaste el juego",
      text: "Ganaste",
    });
    this.reiniciar();
  }

  reiniciar() {
    this.level = 1;
    this.score = 0;
    this.secuencia = [];
    this.pintar();
    this.actualizarTablero();
    this.turno("");
    this.mostrarBoton(true);
  }

  guardar(resultado) {
    guardarPartida({
      jugador: obtenerJugador() || "Anónimo",
      puntuacion: this.score,
      nivel: Math.min(this.level, LAST_LEVEL),
      resultado,
    });
  }
}

async function empezarJuego() {
  await pedirJugador();
  juego = new Juego();
}
