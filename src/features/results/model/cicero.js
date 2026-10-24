import { firstRecord, asRecord } from "./values.js";

const probability = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;

export function normalizeCicero(value) {
  const doc = firstRecord(value) || {};
  const completed = doc.available === true && doc.status === "completed";
  return {
    available: completed,
    status: ["completed", "unavailable", "not_run"].includes(doc.status) ? doc.status : "not_run",
    reason: doc.reason === "model_rights_and_cpu_validation_pending" ? doc.reason : null,
    prediction_count:
      completed && Number.isInteger(doc.prediction_count) && doc.prediction_count >= 0
        ? doc.prediction_count
        : null,
    predictions:
      completed && Array.isArray(doc.predictions)
        ? doc.predictions
            .slice(0, 2)
            .filter(asRecord)
            .map((row) => ({
              id: typeof row.id === "string" ? row.id : "Unreported protein",
              confidence: probability(row.confidence),
              probabilities:
                Array.isArray(row.probabilities) && row.probabilities.length === 10
                  ? row.probabilities.map((position) => {
                      if (!Array.isArray(position) || position.length !== 4) return null;
                      const values = position.map(probability);
                      return values.every((v) => v !== null) &&
                        Math.abs(values.reduce((sum, v) => sum + v, 0) - 1) <= 1e-6
                        ? values
                        : null;
                    })
                  : null,
            }))
        : null,
  };
}
