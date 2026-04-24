function getHealth(_req, res) {
  res.json({
    status: "ok",
    service: "monitoring-tools-backend",
    timestamp: new Date().toISOString(),
  });
}

export { getHealth };
