/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.moysklad.ru" },
    ],
  },
};

export default nextConfig;
