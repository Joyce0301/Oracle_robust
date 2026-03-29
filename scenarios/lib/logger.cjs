function toDisplay(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toDisplay);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toDisplay(nestedValue)])
    );
  }

  return value;
}

function logEvent(stage, payload) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      stage,
      ...toDisplay(payload),
    })
  );
}

module.exports = {
  logEvent,
};
