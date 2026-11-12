import type { NextConfig } from 'next';

// Foto struk lewat server action; bucket membatasi 2 MB.
const config: NextConfig = { experimental: { serverActions: { bodySizeLimit: '2mb' } } };

export default config;
