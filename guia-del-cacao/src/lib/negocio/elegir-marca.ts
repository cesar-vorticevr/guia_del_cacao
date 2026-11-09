"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_MARCA, marcasDeLaCuenta } from "@/lib/negocio/marca-activa";

/** Deja una marca como la que se está administrando. */
export async function recordarMarca(marcaId: string) {
  (await cookies()).set(COOKIE_MARCA, marcaId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

/**
 * El selector del panel. Solo se aceptan las marcas que la base ya le deja
 * administrar (`mis_marcas`): otro id se ignora y el panel sigue donde estaba.
 */
export async function elegirMarca(datos: FormData) {
  const marcaId = datos.get("marca_id")?.toString() ?? "";
  const mias = await marcasDeLaCuenta();
  if (mias.some((m) => m.marca_id === marcaId)) await recordarMarca(marcaId);
  redirect("/negocio/panel");
}
