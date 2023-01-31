const Redis = require("ioredis");
const config = require('config');

const redisClient = new Redis(config.get("REDIS_PORT"), config.get("REDIS_HOST"));

export default redisClient;