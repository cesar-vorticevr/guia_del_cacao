import { redirect } from "next/navigation";

/** Donde vivía el panel de los embajadores; hoy es el panel de ventas (000067). */
export default function Embajador() {
  redirect("/ventas");
}
