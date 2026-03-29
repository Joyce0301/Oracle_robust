const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function getDefaultAddressesPath() {
  return path.join(__dirname, "..", "..", "deployments", `mvp.${hre.network.name}.json`);
}

function loadAddresses(filePath = process.env.DEPLOYMENT_FILE || getDefaultAddressesPath()) {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Deployment file not found: ${resolvedPath}`);
  }

  return {
    filePath: resolvedPath,
    addresses: JSON.parse(fs.readFileSync(resolvedPath, "utf8")),
  };
}

function readScenarioParams(defaults = {}) {
  const raw = process.env.SCENARIO_PARAMS;
  if (!raw) {
    return defaults;
  }

  return { ...defaults, ...JSON.parse(raw) };
}

module.exports = {
  getDefaultAddressesPath,
  loadAddresses,
  readScenarioParams,
};
