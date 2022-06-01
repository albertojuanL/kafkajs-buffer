const { jsWithTs: tsjPreset } = require("ts-jest/presets");

module.exports = {
  transform: {
    ...tsjPreset.transform
  },
  testRegex: ".*\\.(test|spec)\\.ts?$",
  testPathIgnorePatterns: ["/node_modules/"],
  moduleFileExtensions: ["ts", "js", "json"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  collectCoverageFrom: [
    "**/src/**/*.ts",
  ],
};
