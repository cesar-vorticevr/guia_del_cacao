import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Las imágenes se suben a través de Server Actions, y Next.js las corta en
     * 1 MB por defecto: sin esto, cualquier foto de celular fallaba con un 500
     * y sin explicación, aunque el bucket aceptara hasta 5 MB.
     *
     * Va en 6 MB y no en 5: el envío viaja como multipart y las cabeceras de
     * cada parte pesan también. Con el límite exacto, una imagen de justo 5 MB
     * se rechazaría por unos cuantos bytes de sobre.
     */
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
