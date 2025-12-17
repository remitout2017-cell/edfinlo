// utils/cache.js
const NodeCache = require("node-cache");

const cache = new NodeCache({
  stdTTL: 60,       // default TTL in seconds
  checkperiod: 120, // cleanup interval
  useClones: false,
});

function delByPrefix(prefix) {
  const keys = cache.keys().filter((k) => k.startsWith(prefix));
  if (keys.length) cache.del(keys);
}

cache.delByPrefix = delByPrefix;

module.exports = cache;
