import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
 adminCors: "https://viiv.me,http://localhost:5173,http://65.21.144.150:5173",
storeCors: "https://viiv.me,http://localhost:5173,http://65.21.144.150:5173",
authCors: "https://viiv.me,http://localhost:5173,http://65.21.144.150:5173", 
  jwtSecret: process.env.JWT_SECRET || "supersecret",
  cookieSecret: process.env.COOKIE_SECRET || "supersecret",
}
  }
})
