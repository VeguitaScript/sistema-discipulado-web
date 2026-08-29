"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type Resultado = {
  nombre: string;
  nota: number;
  porcentaje: number;
  estado: string;
  fecha_finalizacion: string;
};

export default function NotasProfesoresPage() {
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

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

  function formatearFecha(fecha: string) {
    if (!fecha) return "";

    return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function descargarExcel() {
    const datosExcel = resultados.map((resultado, index) => ({
      "N.°": index + 1,
      "Nombre del participante": resultado.nombre,
      "Nota /20": resultado.nota,
      "Porcentaje": `${resultado.porcentaje}%`,
      Estado: resultado.estado,
      "Fecha de finalización": formatearFecha(
        resultado.fecha_finalizacion
      ),
    }));

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Notas");

    XLSX.writeFile(libro, "notas_discipulado.xlsx");
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
                </tr>
              </thead>

              <tbody>
                {resultados.map((resultado, index) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}