// utils/dateParser.js

function parseDDMMYYYY(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts.map((p) => parseInt(p, 10));
  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day);
}

module.exports = { parseDDMMYYYY };
