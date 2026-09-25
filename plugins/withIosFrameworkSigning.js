const { withXcodeProject } = require('expo/config-plugins');

const PHASE_NAME = '[n-m] Sign Embedded Frameworks';
const SIGNING_SCRIPT = String.raw`set -e

# CocoaPods normally signs vendored frameworks while embedding them. Xcode 27
# can leave prebuilt frameworks (including Hermes) unsigned, so make the final
# app bundle self-consistent before Xcode signs the app itself.
if [ "$PLATFORM_NAME" != "iphoneos" ] || [ "\${CODE_SIGNING_ALLOWED:-YES}" = "NO" ]; then
  exit 0
fi

if [ -z "\${EXPANDED_CODE_SIGN_IDENTITY:-}" ]; then
  echo "error: No expanded signing identity is available for embedded frameworks." >&2
  exit 1
fi

frameworks_dir="\${TARGET_BUILD_DIR}/\${FRAMEWORKS_FOLDER_PATH}"
if [ ! -d "$frameworks_dir" ]; then
  exit 0
fi

find "$frameworks_dir" -depth -type d -name '*.framework' -print0 |
  while IFS= read -r -d '' framework; do
    /usr/bin/codesign --force --sign "$EXPANDED_CODE_SIGN_IDENTITY" \
      --preserve-metadata=identifier,entitlements \
      \${OTHER_CODE_SIGN_FLAGS:-} \
      "$framework"
  done
`;

function withIosFrameworkSigning(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const targetUuid = project.getFirstTarget().uuid;
    const existingPhase = Object.values(
      project.hash.project.objects.PBXShellScriptBuildPhase ?? {},
    ).find((phase) => phase?.name === `"${PHASE_NAME}"`);

    if (!existingPhase) {
      project.addBuildPhase(
        [],
        'PBXShellScriptBuildPhase',
        PHASE_NAME,
        targetUuid,
        {
          shellPath: '/bin/bash',
          shellScript: JSON.stringify(SIGNING_SCRIPT),
        },
      );
    }

    return config;
  });
}

module.exports = withIosFrameworkSigning;
module.exports.PHASE_NAME = PHASE_NAME;
module.exports.SIGNING_SCRIPT = SIGNING_SCRIPT;
