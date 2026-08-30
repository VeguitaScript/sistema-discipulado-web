"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { supabase } from "@/lib/supabase";

type Resultado = {
  participante_id: string;
  nombre: string;
  nota: number;
  porcentaje: number;
  estado: string;
  fecha_finalizacion: string;
};

type RespuestaAlumno = {
  numero: number;
  pregunta: string;
  respuesta_marcada: string;
  respuesta_correcta: string;
  es_correcta: boolean;
  explicacion: string | null;
};

export default function NotasProfesoresPage() {
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
const [alumnoSeleccionado, setAlumnoSeleccionado] =
  useState<Resultado | null>(null);
const [respuestasAlumno, setRespuestasAlumno] = useState<
  RespuestaAlumno[]
>([]);
const [cargandoRespuestas, setCargandoRespuestas] = useState(false);

  useEffect(() => {
    cargarResultados();
  }, []);

  async function cargarResultados() {
    setCargando(true);
    setError("");

    const { data, error } = await supabase.rpc(
      "obtener_resultados_profesores"
    );

    if (error) {
      setError(error.message);
      setCargando(false);
      return;
    }

    setResultados(data ?? []);
    setCargando(false);
  }

  const resultadosFiltrados = resultados.filter((resultado) =>
  resultado.nombre
    .toLowerCase()
    .includes(busqueda.toLowerCase().trim())
);

  function formatearFecha(fecha: string) {
  return fecha || "";
}

  async function verRespuestas(alumno: Resultado) {
  setAlumnoSeleccionado(alumno);
  setCargandoRespuestas(true);
  setRespuestasAlumno([]);

  const { data, error } = await supabase.rpc(
    "obtener_respuestas_profesor",
    {
      p_participante_id: alumno.participante_id,
    }
  );

  if (error) {
    setError(error.message);
    setCargandoRespuestas(false);
    return;
  }

  setRespuestasAlumno(data ?? []);
  setCargandoRespuestas(false);
}

  async function descargarExcel() {
  const { data: respuestas, error } = await supabase.rpc(
    "obtener_todas_respuestas_profesor"
  );

  if (error) {
    setError(error.message);
    return;
  }

  if (!respuestas || respuestas.length === 0) {
    setError("No existen respuestas para descargar.");
    return;
  }

  const preguntas = Array.from(
    new Map(
      respuestas.map((respuesta: any) => [
        respuesta.numero,
        {
          numero: respuesta.numero,
          pregunta: respuesta.pregunta,
        },
      ])
    ).values()
  ).sort((a: any, b: any) => a.numero - b.numero);

  const alumnos = Array.from(
    new Map(
      respuestas.map((respuesta: any) => [
        respuesta.participante_id,
        {
          participante_id: respuesta.participante_id,
          nombre: respuesta.nombre,
          nota: respuesta.nota,
          fecha_finalizacion: respuesta.fecha_finalizacion,
        },
      ])
    ).values()
  );

  const encabezados = [
    ...preguntas.map(
      (pregunta: any) =>
        `${pregunta.numero}. ${pregunta.pregunta}`
    ),
    "Puntuación",
    "Nombres y Apellidos",
    "Fecha",
  ];

  const filas = alumnos.map((alumno: any) => {
    const respuestasDelAlumno = respuestas.filter(
      (respuesta: any) =>
        respuesta.participante_id === alumno.participante_id
    );

    const respuestasPorPregunta = preguntas.map((pregunta: any) => {
      const respuesta = respuestasDelAlumno.find(
        (item: any) => item.numero === pregunta.numero
      );

      return respuesta?.respuesta_marcada ?? "";
    });

    return [
      ...respuestasPorPregunta,
      alumno.nota,
      alumno.nombre,
      formatearFecha(alumno.fecha_finalizacion),
    ];
  });

  const hoja = XLSX.utils.aoa_to_sheet([
    encabezados,
    ...filas,
  ]);

  const ultimaFila = filas.length + 1;
  const ultimaColumna = encabezados.length - 1;

  const rango = XLSX.utils.decode_range(
    hoja["!ref"] as string
  );

  const borde = {
    top: {
      style: "thin",
      color: { rgb: "D9D9E3" },
    },
    bottom: {
      style: "thin",
      color: { rgb: "D9D9E3" },
    },
    left: {
      style: "thin",
      color: { rgb: "D9D9E3" },
    },
    right: {
      style: "thin",
      color: { rgb: "D9D9E3" },
    },
  };

  for (let fila = rango.s.r; fila <= rango.e.r; fila++) {
    for (
      let columna = rango.s.c;
      columna <= rango.e.c;
      columna++
    ) {
      const celda = hoja[
        XLSX.utils.encode_cell({ r: fila, c: columna })
      ];

      if (!celda) continue;

      celda.s = {
        border: borde,
        alignment: {
          vertical: "center",
          horizontal: fila === 0 ? "center" : "left",
          wrapText: true,
        },
        font: {
          name: "Arial",
          sz: 10,
          bold: fila === 0,
          color: {
            rgb: fila === 0 ? "FFFFFF" : "222222",
          },
        },
        fill: {
          fgColor: {
            rgb:
              fila === 0
                ? "5E35B1"
                : fila % 2 === 0
                ? "F4F1FB"
                : "FFFFFF",
          },
        },
      };
    }
  }

  // Destacar las columnas finales
  for (let fila = 1; fila <= ultimaFila; fila++) {
    const celdaNota = hoja[
      XLSX.utils.encode_cell({
        r: fila,
        c: ultimaColumna - 2,
      })
    ];

    const celdaNombre = hoja[
      XLSX.utils.encode_cell({
        r: fila,
        c: ultimaColumna - 1,
      })
    ];

    const celdaFecha = hoja[
      XLSX.utils.encode_cell({
        r: fila,
        c: ultimaColumna,
      })
    ];

    [celdaNota, celdaNombre, celdaFecha].forEach((celda) => {
      if (celda) {
        celda.s = {
          ...celda.s,
          font: {
            name: "Arial",
            sz: 10,
            bold: true,
            color: { rgb: "222222" },
          },
        };
      }
    });
  }

  hoja["!cols"] = [
    ...preguntas.map(() => ({ wch: 32 })),
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
  ];

  hoja["!rows"] = [
    { hpt: 95 },
    ...filas.map(() => ({ hpt: 28 })),
  ];

  hoja["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_col(ultimaColumna)}${ultimaFila}`,
  };

  hoja["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
  };

  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    libro,
    hoja,
    "Resultados"
  );

  XLSX.writeFile(
    libro,
    "resultados_discipulado.xlsx"
  );
}

  return (
    <main className="container">
      <section className="card hero">
        <h1>Resultados del discipulado</h1>

        <p className="muted">
          Consulta las notas de los participantes que finalizaron el examen.
        </p>
      </section>

      <section className="card">
        <div className="actions">
          <button
            className="primary"
            type="button"
            onClick={descargarExcel}
            disabled={resultados.length === 0}
          >
            Descargar Excel
          </button>

          <button type="button" onClick={cargarResultados}>
            Actualizar resultados
          </button>
        </div>
      </section>

      <section className="card">
        {cargando && <p>Cargando resultados…</p>}

        {error && <p className="required">{error}</p>}

        {!cargando && !error && resultados.length === 0 && (
          <p className="muted">
            Todavía no hay participantes que hayan finalizado el examen.
          </p>
        )}

        <div className="search-box">
  <label htmlFor="buscar-alumno">
    Buscar alumno
  </label>

  <input
    id="buscar-alumno"
    type="search"
    placeholder="Escribe el nombre del alumno..."
    value={busqueda}
    onChange={(event) => setBusqueda(event.target.value)}
  />
</div>

        {!cargando && resultados.length > 0 && (
          <div className="table-wrapper">
            <table className="results-table">
              <thead>
                <tr>
                  <th>N.°</th>
                  <th>Participante</th>
                  <th>Nota</th>
                  <th>Porcentaje</th>
                  <th>Estado</th>
                  <th>Fecha de finalización</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {resultadosFiltrados.map((resultado, index) => (
                  <tr key={`${resultado.nombre}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{resultado.nombre}</td>
                    <td>{Number(resultado.nota).toFixed(1)}</td>
                    <td>{resultado.porcentaje}%</td>
                    <td>
                      <span
                        className={
                          resultado.estado === "APROBADO"
                            ? "status-approved"
                            : "status-failed"
                        }
                      >
                        {resultado.estado}
                      </span>
                    </td>
                    <td>
                      {formatearFecha(resultado.fecha_finalizacion)}
                    </td>
                    <td>
  <button
    type="button"
    onClick={() => verRespuestas(resultado)}
  >
    Ver respuestas
  </button>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
         {alumnoSeleccionado && (
          <div className="answer-review">
            <div className="answer-review-header">
              <h2>
                Respuestas de {alumnoSeleccionado.nombre}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setAlumnoSeleccionado(null);
                  setRespuestasAlumno([]);
                }}
              >
                Cerrar
              </button>
            </div>

            {cargandoRespuestas && (
              <p>Cargando respuestas…</p>
            )}

            {!cargandoRespuestas &&
              respuestasAlumno.map((respuesta) => (
                <article
                  key={respuesta.numero}
                  className={
                    respuesta.es_correcta
                      ? "answer-correct"
                      : "answer-incorrect"
                  }
                >
                  <strong>
                    Pregunta {respuesta.numero}
                  </strong>

                  <p>{respuesta.pregunta}</p>

                  <p>
                    Respuesta marcada:{" "}
                    <strong>{respuesta.respuesta_marcada}</strong>
                  </p>

                  <p>
                    Respuesta correcta:{" "}
                    <strong>{respuesta.respuesta_correcta}</strong>
                  </p>

                  <p>
                    Resultado:{" "}
                    {respuesta.es_correcta
                      ? "Correcta"
                      : "Incorrecta"}
                  </p>

                  {respuesta.explicacion && (
                    <p>
                      <strong>Explicación:</strong>{" "}
                      {respuesta.explicacion}
                    </p>
                  )}
                </article>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}