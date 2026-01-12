/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APIFY_TOKEN: string
    readonly VITE_GEMINI_API_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare namespace NodeJS {
    interface ProcessEnv {
        NEXT_PUBLIC_S3_ACCESS_KEY: string
        NEXT_PUBLIC_S3_SECRET_KEY: string
        NEXT_PUBLIC_S3_BUCKET_NAME: string
        GEMINI_API_KEY: string
        API_KEY: string
    }
}
