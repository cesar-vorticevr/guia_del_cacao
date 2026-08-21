import { ESTADO, type EstadoSucursal } from "@/lib/tipos";

export function InsigniaEstado({ estado }: { estado: EstadoSucursal }) {
  const { texto, tono } = ESTADO[estado];

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${tono}`}>{texto}</span>
  );
}
