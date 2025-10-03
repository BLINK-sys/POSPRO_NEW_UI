/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  trailingSlash: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '8e191e4bcc63.ngrok-free.app',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'a4550e922a9f.ngrok-free.app',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.onrender.com',
        port: '',
        pathname: '/**',
      }
    ],
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  }
}

export default nextConfig
