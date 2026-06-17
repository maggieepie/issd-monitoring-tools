function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.code === "LIMIT_FILE_SIZE" ? 400 : 500);
  const message =
    err.code === "LIMIT_FILE_SIZE"
      ? "Attachment must be 5 MB or smaller."
      : err.message || "Internal server error";

  res.status(status).json({ message });
}

export { errorHandler };
