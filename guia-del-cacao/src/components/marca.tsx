import Link from "next/link";

/** La mazorca del prototipo: un óvalo con la punta hacia abajo. */
export function Mazorca({ className = "h-6 w-5" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-mango ${className}`}
      style={{ borderRadius: "60% 60% 55% 55% / 70% 70% 40% 40%" }}
    />
  );
}

export function Logotipo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 font-display text-xl font-bold text-crema"
    >
      <Mazorca />
      Guía del Cacao
    </Link>
  );
}
