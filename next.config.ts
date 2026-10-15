import type { NextConfig } from "next";

// App privada e totalmente dinâmica (cada página lê a sessão): sem Cache Components.
const nextConfig: NextConfig = {
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
