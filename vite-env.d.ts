/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APIFY_TOKEN: string
    readonly VITE_GEMINI_API_KEY: string
    readonly VITE_AWS_ACCESS_KEY_ID: string
    readonly VITE_AWS_SECRET_ACCESS_KEY: string
    readonly VITE_S3_BUCKET: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
