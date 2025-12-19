const client = require("prom-client");

// Collect ONLY default system metrics
client.collectDefaultMetrics({
  prefix: "node_",
  gcDurationBuckets: [0.1, 0.2, 0.5, 1],
});

module.exports = client;
