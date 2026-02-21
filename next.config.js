/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle pdfmake on the server — it's browser-only
      config.externals = [...(config.externals || []), "pdfmake/build/pdfmake", "pdfmake/build/vfs_fonts"];
    }
    return config;
  },
};

module.exports = nextConfig;
