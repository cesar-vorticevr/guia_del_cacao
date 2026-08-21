import { Logotipo } from "@/components/marca";

export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="bg-selva py-3.5">
        <div className="mx-auto w-[92vw] max-w-[1180px]">
          <Logotipo />
        </div>
      </header>

      <main className="mx-auto w-[92vw] max-w-md py-8 sm:py-12">{children}</main>
    </>
  );
}
