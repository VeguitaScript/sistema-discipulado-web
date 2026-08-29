"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Configuracion = {
  titulo: string;
  descripcion: string | null;
  instrucciones: string | null;
  nota_minima: number;
  examen_activo: boolean;
};

type Pregunta = {
  codigo: string;
  numero: number;
  enunciado: string;
  alternativa_a: string | null;
  alternativa_b: string | null;
  alternativa_c: string | null;
  alternativa_d: string | null;
  orden: number;
};

type Participante = {
  id: string;
  nombre: string;
  estado: string;
  pregunta_actual: number;
};

type Respuestas = Record<string, string>;

export default function Home() {
  const [pantalla, setPantalla] = useState<
    "cargando" | "inicio" | "examen"
  >("cargando");

  const [configuracion, setConfiguracion] =
    useState<Configuracion | null>(null);
  const [participante, setParticipante] =
    useState<Participante | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [iniciando, setIniciando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
const [finalizando, setFinalizando] = useState(false);
const [preguntasFaltantes, setPreguntasFaltantes] =
  useState<number | null>(null);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState(
  "El avance se guarda automáticamente."
);


  useEffect(() => {
    async function cargarConfiguracion() {
      const { data, error } = await supabase
        .from("configuracion")
        .select(
          "titulo, descripcion, instrucciones, nota_minima, examen_activo"
        )
        .single();

      if (error) {
        setError(error.message);
      } else {
        setConfiguracion(data);
        setPantalla("inicio");
      }
    }

    cargarConfiguracion();
  }, []);

  useEffect(() => {
  if (!participante || Object.keys(respuestas).length === 0) {
    return;
  }

  setEstadoGuardado("Guardando avance…");

  const temporizador = setTimeout(async () => {
    const numerosRespondidos = preguntas
      .filter((pregunta) => respuestas[pregunta.codigo])
      .map((pregunta) => pregunta.numero);

    const preguntaActual =
      numerosRespondidos.length > 0
        ? Math.max(...numerosRespondidos)
        : 1;

    const { data, error } = await supabase.rpc("guardar_progreso", {
      p_participante_id: participante.id,
      p_respuestas: respuestas,
      p_pregunta_actual: preguntaActual,
    });

    if (error) {
      setEstadoGuardado("No se pudo sincronizar el avance.");
      return;
    }

    setEstadoGuardado(
      `Avance guardado (${data?.[0]?.respuestas_guardadas ?? 0} respuestas).`
    );
  }, 1500);

  return () => clearTimeout(temporizador);
}, [respuestas, participante, preguntas]);

  async function iniciarExamen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!nombre.trim()) {
      setError("Ingrese sus nombres y apellidos completos.");
      return;
    }

    setIniciando(true);

    const { data, error: participanteError } = await supabase.rpc(
      "iniciar_o_reanudar_examen",
      {
        p_nombre: nombre.trim(),
      }
    );

    if (participanteError) {
      setError(participanteError.message);
      setIniciando(false);
      return;
    }

    const participanteObtenido = Array.isArray(data) ? data[0] : data;

    if (participanteObtenido.estado === "FINALIZADO") {
  const { data: resultadoFinal, error: resultadoError } =
    await supabase.rpc("finalizar_examen", {
      p_participante_id: participanteObtenido.id,
    });

  if (resultadoError) {
    setError(resultadoError.message);
    setIniciando(false);
    return;
  }

  setResultado(resultadoFinal);
  setIniciando(false);
  return;
}

    const { data: preguntasData, error: preguntasError } = await supabase
      .from("preguntas_publicas")
      .select(
        "codigo, numero, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, orden"
      )
      .order("orden", { ascending: true });

    if (preguntasError) {
      setError(preguntasError.message);
      setIniciando(false);
      return;
    }

    const { data: respuestasServidor, error: respuestasError } =
  await supabase.rpc("obtener_respuestas_participante", {
    p_participante_id: participanteObtenido.id,
  });

if (respuestasError) {
  setError(respuestasError.message);
  setIniciando(false);
  return;
}

const respuestasGuardadas = localStorage.getItem(
  `discipulado_respuestas_${participanteObtenido.id}`
);

const respuestasLocales = respuestasGuardadas
  ? JSON.parse(respuestasGuardadas)
  : {};

const respuestasIniciales = {
  ...(respuestasServidor ?? {}),
  ...respuestasLocales,
};

setParticipante(participanteObtenido);
setPreguntas(preguntasData ?? []);
setRespuestas(respuestasIniciales);

    setPantalla("examen");
    setIniciando(false);
  }

  function seleccionarRespuesta(codigo: string, respuesta: string) {
    if (!participante) return;

    setPreguntasFaltantes(null);

    const nuevasRespuestas = {
      ...respuestas,
      [codigo]: respuesta,
    };

    setRespuestas(nuevasRespuestas);

    localStorage.setItem(
      `discipulado_respuestas_${participante.id}`,
      JSON.stringify(nuevasRespuestas)
    );
  }

  async function enviarExamen(confirmado = false) {
  if (!participante) return;

  const faltantes = preguntas.filter(
    (pregunta) => !respuestas[pregunta.codigo]
  );

  if (faltantes.length > 0) {
  setPreguntasFaltantes(faltantes.length);

  // document
  //   .getElementById(`question-${faltantes[0].codigo}`)
  //   ?.scrollIntoView({ behavior: "smooth", block: "center" });

  return;
}

setPreguntasFaltantes(null);

  if (!confirmado) {
  setConfirmandoEnvio(true);
  return;
}

  setFinalizando(true);
  setEstadoGuardado("Guardando las últimas respuestas…");

  const { error: guardadoError } = await supabase.rpc(
    "guardar_progreso",
    {
      p_participante_id: participante.id,
      p_respuestas: respuestas,
      p_pregunta_actual: preguntas.length,
    }
  );

  if (guardadoError) {
    setEstadoGuardado("No se pudieron guardar las respuestas.");
    setFinalizando(false);
    return;
  }

  const { data, error: calificacionError } = await supabase.rpc(
    "finalizar_examen",
    {
      p_participante_id: participante.id,
    }
  );

  if (calificacionError) {
    alert(calificacionError.message);
    setFinalizando(false);
    return;
  }

  setResultado(data);
  setConfirmandoEnvio(false);
  setFinalizando(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (resultado) {
  const aprobado = resultado.outcome === "APROBADO";

  return (
    <>
      <div className="topbar" />

      <main className="container">
        <section className="card hero score-panel">
          <h1>Resultado de {resultado.participantName}</h1>

          <div className="score">
            {resultado.score20}/20
          </div>

          <p>
            <strong>{resultado.correctCount}</strong> de{" "}
            <strong>{resultado.totalQuestions}</strong> respuestas correctas ·{" "}
            {resultado.percentage}%
          </p>

          <span className={`outcome ${aprobado ? "pass" : "fail"}`}>
            {resultado.outcome}
          </span>

          <p className="muted">
            Nota mínima aprobatoria: {resultado.passingScore}/20
          </p>
        </section>

        <section className="card">
          <h2>Comparación de respuestas</h2>
          <p className="muted">
            Revisa tus respuestas y la respuesta correcta.
          </p>
        </section>

        {resultado.comparison.map((item: any, index: number) => (
          <article
            key={item.codigo}
            className={`card review ${
              item.esCorrecta ? "correct" : "incorrect"
            }`}
          >
            <div className="question-number">
              Pregunta {index + 1}
            </div>

            <div className="question-text">
              {item.texto}
            </div>

            <div
              className={`answer-box ${
                item.esCorrecta ? "correct" : "incorrect"
              }`}
            >
              Tu respuesta:{" "}
              <strong>
                {item.respuestaSeleccionada}
                {item.alternativas?.[item.respuestaSeleccionada]
                  ? `. ${item.alternativas[item.respuestaSeleccionada]}`
                  : ""}
              </strong>
            </div>

            {!item.esCorrecta && (
              <div className="answer-box correct">
                Respuesta correcta:{" "}
                <strong>
                  {item.respuestaCorrecta}
                  {item.alternativas?.[item.respuestaCorrecta]
                    ? `. ${item.alternativas[item.respuestaCorrecta]}`
                    : ""}
                </strong>
              </div>
            )}

            {item.explicacion && (
              <div className="explanation">
                <strong>Explicación:</strong> {item.explicacion}
              </div>
            )}
          </article>
        ))}
      </main>
    </>
  );
}

  if (pantalla === "cargando") {
    return (
      <>
        <div className="topbar" />
        <main className="container">
          <section className="card loader">
            Cargando el examen…
          </section>
        </main>
      </>
    );
  }

  const respondidas = Object.keys(respuestas).filter(
    (codigo) => respuestas[codigo]
  ).length;

  const progreso = preguntas.length
    ? (respondidas / preguntas.length) * 100
    : 0;

  return (
    <>
      <div className="topbar" />

      <main className="container">
        {pantalla === "inicio" && (
          <>
            <section className="card hero">
              <h1>{configuracion?.titulo}</h1>

              <p className="muted">
                {configuracion?.descripcion}
              </p>

              <p>{configuracion?.instrucciones}</p>

              <p className="muted">
                <span className="required">*</span> Todas las preguntas son
                obligatorias.
              </p>
            </section>

            <section className="card">
              <form onSubmit={iniciarExamen}>
                <label className="field-label" htmlFor="nombre">
                  Nombres y apellidos completos{" "}
                  <span className="required">*</span>
                </label>

                <input
                  id="nombre"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  placeholder="Ejemplo: Juan Pérez López"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                />

                <div className="actions">
                  <span className="save-status">
                    Use el mismo nombre si necesita continuar después.
                  </span>

                  <button
                    className="primary"
                    type="submit"
                    disabled={iniciando}
                  >
                    {iniciando
                      ? "Ingresando…"
                      : "Comenzar o continuar"}
                  </button>
                </div>

                {error && <p className="required">{error}</p>}
              </form>
            </section>
          </>
        )}

        {pantalla === "examen" && participante && (
          <>
            <section className="card hero">
              <h1>{configuracion?.titulo}</h1>

              <span className="participant-chip">
                {participante.nombre}
              </span>
            </section>

            <div className="progress-shell">
              <div className="progress-row">
                <span>Progreso</span>
                <span>
                  {respondidas} de {preguntas.length} respondidas
                </span>
              </div>

              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>

            <div>
              {preguntas.map((pregunta, index) => {
                const alternativas = [
                  { letra: "A", texto: pregunta.alternativa_a },
                  { letra: "B", texto: pregunta.alternativa_b },
                  { letra: "C", texto: pregunta.alternativa_c },
                  { letra: "D", texto: pregunta.alternativa_d },
                ];

                return (
                  <article
                    className="card"
                    id={`question-${pregunta.codigo}`}
                    key={pregunta.codigo}
                  >
                    <div className="question-number">
                      Pregunta {index + 1} de {preguntas.length}
                    </div>

                    <div className="question-text">
                      {pregunta.enunciado}{" "}
                      <span className="required">*</span>
                    </div>

                    {alternativas.map(
                      (alternativa) =>
                        alternativa.texto && (
                          <label
                            className="option"
                            key={alternativa.letra}
                          >
                            <input
                              type="radio"
                              name={`pregunta-${pregunta.codigo}`}
                              value={alternativa.letra}
                              checked={
                                respuestas[pregunta.codigo] ===
                                alternativa.letra
                              }
                              onChange={() =>
                                seleccionarRespuesta(
                                  pregunta.codigo,
                                  alternativa.letra
                                )
                              }
                            />

                            <span>
                              <strong>{alternativa.letra}.</strong>{" "}
                              {alternativa.texto}
                            </span>
                          </label>
                        )
                    )}
                  </article>
                );
              })}
            </div>

           {confirmandoEnvio ? (
  <div className="confirmation-box">
    <div>
      <strong>¿Estás seguro de enviar el examen?</strong>
      <br />
      <span className="save-status">
        Después no podrás cambiar tus respuestas.
      </span>
    </div>

    <div className="confirmation-actions">
      <button
        type="button"
        onClick={() => setConfirmandoEnvio(false)}
        disabled={finalizando}
      >
        No, volver
      </button>

      <button
        className="primary"
        type="button"
        onClick={() => enviarExamen(true)}
        disabled={finalizando}
      >
        {finalizando ? "Calificando…" : "Sí, enviar examen"}
      </button>
    </div>
  </div>
) : (
  <div className="actions">
    <span className="save-status">
      {preguntasFaltantes !== null
        ? `Faltan responder ${preguntasFaltantes} pregunta(s).`
        : estadoGuardado}
    </span>

    <button
      className="primary"
      type="button"
      onClick={() => enviarExamen(false)}
      disabled={finalizando}
    >
      Enviar examen
    </button>
  </div>
)}
          </>
        )}
      </main>
    </>
  );
}