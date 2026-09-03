import Link from "next/link";
import type { Metadata } from "next";
import { BotonGoogle } from "@/components/boton-google";
import { FormularioLogin } from "@/components/formularios-auth";
import { Aviso } from "@/components/formulario";

export const metadata: Metadata = { title: "Iniciar sesión · Guía del Cacao" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; volver?: string }>;
}) {
  const { error, volver } = await searchParams;

  return (
    <div className="grid gap-5">
      <h1 className="font-display text-3xl">Iniciar sesión</h1>

      {error === "google" && (
        <Aviso>No se pudo entrar con Google. Intenta con tu correo.</Aviso>
      )}

      {/* Los enlaces del correo caducan y son de un solo uso: quien llega con
          uno vencido necesita saber que puede pedir otro, no un "algo salió
          mal". */}
      {error === "enlace" && (
        <Aviso>
          Ese enlace ya no sirve: caducó o ya se usó. Pide uno nuevo desde
          «Olvidé mi contraseña».
        </Aviso>
      )}

      <FormularioLogin />

      <p className="text-center">
        <Link href="/recuperar" className="font-bold text-selva underline">
          Olvidé mi contraseña
        </Link>
      </p>

      <div className="flex items-center gap-3 text-sm text-cacao/60">
        <span className="h-px flex-1 bg-selva/15" />o
        <span className="h-px flex-1 bg-selva/15" />
      </div>

      <BotonGoogle texto="Entrar con Google" volver={volver ?? null} />

      <p className="text-center text-cacao">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-bold text-selva underline">
          Crear una
        </Link>
      </p>
    </div>
  );
}
