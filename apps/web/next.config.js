/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dynamic terminal routes need uncached params/data flow in App Router
  cacheComponents: false,
  
  // Paquetes que no se deben bundlear en el servidor
  serverExternalPackages: ['@libsql/client'],
  
  // Transpilar paquetes compartidos del monorepo
  transpilePackages: ['@terminal-nexus/shared'],
}

module.exports = nextConfig
