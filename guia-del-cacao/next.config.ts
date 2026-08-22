import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Las imágenes se suben a través de Server Actions, y Next.js las corta en
     * 1 MB por defecto: sin esto, cualquier foto de celular fallaba con un 500
     * y sin explicación, aunque el bucket aceptara hasta 5 MB.
     *
     * Va por encima del tope del bucket y no exacto: el envío viaja como
     * multipart y las cabeceras de cada parte pesan también. Con el límite
     * justo, un archivo de justo 20 MB se rechazaría por unos bytes de sobre.
     *
     * Son 22 y no 6 desde que se aceptan videos en reseñas y comprobantes.
     */
    serverActions: {
      bodySizeLimit: "22mb",
    },
  },
};

export default nextConfig;
