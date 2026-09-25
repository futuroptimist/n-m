const { withPodfile, withXcodeProject } = require('@expo/config-plugins');

const PHASE_NAME = '[n-m] Sign Embedded Frameworks';
const PODFILE_MARKER = 'n-m: keep framework signing after CocoaPods embedding';

const SIGNING_SCRIPT = `set -e

if [ "$PLATFORM_NAME" != "iphoneos" ] || [ "\${CODE_SIGNING_ALLOWED:-YES}" = "NO" ]; then
  exit 0
fi

if [ -z "\${EXPANDED_CODE_SIGN_IDENTITY:-}" ]; then
  echo "error: An iPhone device build must provide EXPANDED_CODE_SIGN_IDENTITY." >&2
  exit 1
fi

frameworks_dir="$TARGET_BUILD_DIR/$FRAMEWORKS_FOLDER_PATH"
if [ ! -d "$frameworks_dir" ]; then
  exit 0
fi

find "$frameworks_dir" -depth -type d -name '*.framework' -print |
while IFS= read -r framework; do
  echo "Signing embedded framework: $framework"
  /usr/bin/codesign --force --sign "$EXPANDED_CODE_SIGN_IDENTITY" \
    --preserve-metadata=identifier,entitlements "$framework"
done`;

const PODFILE_HOOK = `

# ${PODFILE_MARKER}
post_integrate do |installer|
  installer.aggregate_targets.map(&:user_project).uniq.each do |project|
    project.targets.each do |target|
      signing_phase = target.shell_script_build_phases.find { |phase| phase.name == '${PHASE_NAME}' }
      embed_phase = target.shell_script_build_phases.find { |phase| phase.name == '[CP] Embed Pods Frameworks' }
      next unless signing_phase && embed_phase

      target.build_phases.delete(signing_phase)
      target.build_phases.insert(target.build_phases.index(embed_phase) + 1, signing_phase)
    end
    project.save
  end
end
`;

function withIosFrameworkSigning(config) {
  config = withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const target = project.getFirstTarget().uuid;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
    const alreadyAdded = Object.values(phases).some(
      (phase) => phase && phase.name === `"${PHASE_NAME}"`,
    );

    if (!alreadyAdded) {
      const { buildPhase } = project.addBuildPhase(
        [],
        'PBXShellScriptBuildPhase',
        PHASE_NAME,
        target,
        {
          shellPath: '/bin/sh',
          shellScript: SIGNING_SCRIPT,
        },
      );
      buildPhase.alwaysOutOfDate = 1;
    }

    return modConfig;
  });

  return withPodfile(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes(PODFILE_MARKER)) {
      modConfig.modResults.contents += PODFILE_HOOK;
    }
    return modConfig;
  });
}

module.exports = withIosFrameworkSigning;
