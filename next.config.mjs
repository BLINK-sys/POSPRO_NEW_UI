/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pospro-new-server.onrender.com',
        port: '',
        pathname: '/uploads/**',
      },
    ],
  },
  // Отключаем статическую генерацию для всех страниц
  output: 'standalone',
};

export default nextConfig;
