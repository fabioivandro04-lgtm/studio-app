import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Estúdio',
    short_name: 'Estúdio',
    description: 'Organizar, agendar, publicar e medir conteúdo.',
    lang: 'pt-PT',
    start_url: '/calendario',
    display: 'standalone',
    theme_color: '#0B1F45',
    background_color: '#0B1F45',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
