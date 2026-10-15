import type { NextConfig } from "next";

// App privada e totalmente dinâmica (cada página lê a sessão): sem Cache Components.
const nextConfig: NextConfig = {
  // O browser guarda as páginas já vistas (e as pré-carregadas) por uns segundos: voltar a elas é imediato.
  // As server actions que gravam dados chamam revalidatePath, que limpa esta cache.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
