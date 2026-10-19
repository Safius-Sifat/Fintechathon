// Adds the GitHub Packages repository that serves Trust Wallet Core to the
// generated Android project. exclusiveContent makes com.trustwallet resolve
// only from this repository, and this repository serve nothing else.
// Credentials are read by Gradle at build time from the gpr.user / gpr.key
// Gradle properties (e.g. ~/.gradle/gradle.properties) or the GPR_USER /
// GPR_KEY environment variables. They are never written to the project.
const { withProjectBuildGradle } = require("expo/config-plugins");

const MARKER = "// mandate: Trust Wallet Core repository";
const REPOSITORY = `
${MARKER}
allprojects {
  repositories {
    exclusiveContent {
      forRepository {
        maven {
          url 'https://maven.pkg.github.com/trustwallet/wallet-core'
          credentials {
            username = providers.gradleProperty('gpr.user')
                .orElse(providers.environmentVariable('GPR_USER')).getOrNull()
            password = providers.gradleProperty('gpr.key')
                .orElse(providers.environmentVariable('GPR_KEY')).getOrNull()
          }
        }
      }
      filter {
        includeGroup 'com.trustwallet'
      }
    }
  }
}
`;

module.exports = function withOwnerWallet(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error("owner-wallet: expected android/build.gradle (Groovy)");
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += REPOSITORY;
    }
    return cfg;
  });
};
