import { Redis } from '@upstash/redis'

//Cấu hình redis đã deploy trên Upstash
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})
