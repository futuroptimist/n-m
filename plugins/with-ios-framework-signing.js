const { withXcodeProject } = require('@expo/config-plugins');

const PHASE_NAME = '[n^m] Sign Embedded Frameworks';
const SIGNING_SCRIPT = `set -e

if [ "\${PLATFORM_NAME:-}" != "iphoneos" ] || [ "\${CODE_SIGNING_ALLOWED:-NO}" != "YES" ]; then
  exit 0
fi

frameworks_dir="\${TARGET_BUILD_DIR}/\${FRAMEWORKS_FOLDER_PATH}"
if [ ! -d "$frameworks_dir" ]; then
  exit 0
fi

signing_identity="\${EXPANDED_CODE_SIGN_IDENTITY:-\${CODE_SIGN_IDENTITY:-}}"
if [ -z "$signing_identity" ] || [ "$signing_identity" = "-" ]; then
  echo "error: An iPhoneOS signing identity is required to sign embedded frameworks." >&2
  exit 1
fi

for framework in "$frameworks_dir"/*.framework; do
  [ -d "$framework" ] || continue
  echo "Signing embedded framework: $framework"
  /usr/bin/codesign --force --sign "$signing_identity" --preserve-metadata=identifier,entitlements "$framework"
done`;

function withIosFrameworkSigning(config) {
  return withXcodeProject(config, (configWithProject) => {
    const project = configWithProject.modResults;
    const shellPhases =
      project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const existingPhase = Object.values(shellPhases).find(
      (phase) =>
        phase && typeof phase === 'object' && phase.name === `"${PHASE_NAME}"`,
    );

    if (!existingPhase) {
      project.addBuildPhase(
        [],
        'PBXShellScriptBuildPhase',
        PHASE_NAME,
        project.getFirstTarget().uuid,
        {
          inputPaths: ['"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)"'],
          outputPaths: [],
          shellPath: '/bin/sh',
          shellScript: SIGNING_SCRIPT,
        },
      );
    }

    return configWithProject;
  });
}

module.exports = withIosFrameworkSigning;
module.exports.PHASE_NAME = PHASE_NAME;
module.exports.SIGNING_SCRIPT = SIGNING_SCRIPT;
