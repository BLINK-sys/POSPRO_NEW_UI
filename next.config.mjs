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
  // Отключаем статическую генерацию для страниц с аутентификацией
  experimental: {
    // Отключаем автоматическую статическую оптимизацию
    staticPageGenerationTimeout: 0,
  },
  // Настройки для страниц, которые не должны быть статическими
  async generateStaticParams() {
    return [];
  },
  // Отключаем статическую генерацию для всех страниц
  output: 'standalone',
};

export default nextConfig;
