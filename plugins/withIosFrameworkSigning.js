const { withPodfile } = require('expo/config-plugins');

const HELPER_MARKER =
  '# n-m: ensure embedded frameworks are signed for physical devices';
const PHASE_NAME = '[n-m] Sign Embedded Frameworks';

const helper = `${HELPER_MARKER}
def nm_add_framework_signing_phase(installer)
  installer.aggregate_targets.map(&:user_project).compact.uniq.each do |project|
    project.native_targets.each do |target|
      next unless target.product_type == 'com.apple.product-type.application'

      phase = target.shell_script_build_phases.find { |candidate| candidate.name == '${PHASE_NAME}' }
      phase ||= target.new_shell_script_build_phase('${PHASE_NAME}')
      phase.shell_path = '/bin/sh'
      phase.shell_script = <<~'SCRIPT'
        set -eu

        # Simulator frameworks do not require an installable device signature.
        if [ "\${PLATFORM_NAME:-}" != "iphoneos" ]; then
          exit 0
        fi

        if [ -z "\${EXPANDED_CODE_SIGN_IDENTITY:-}" ]; then
          echo "error: No code-signing identity is available for embedded frameworks." >&2
          exit 1
        fi

        frameworks_dir="\${TARGET_BUILD_DIR}/\${FRAMEWORKS_FOLDER_PATH}"
        if [ ! -d "$frameworks_dir" ]; then
          exit 0
        fi

        /usr/bin/find "$frameworks_dir" -depth -type d -name '*.framework' -exec \\
          /usr/bin/codesign --force --sign "$EXPANDED_CODE_SIGN_IDENTITY" \\
          --preserve-metadata=identifier,entitlements,flags {} \\;
      SCRIPT
      phase.always_out_of_date = '1'

      # CocoaPods has created its embed phases before post_install runs. Keeping
      # this phase last guarantees that it signs the final copied frameworks.
      target.build_phases.move(phase, target.build_phases.length - 1)
    end
  end
end

`;

function withIosFrameworkSigning(config) {
  return withPodfile(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (contents.includes(HELPER_MARKER)) {
      return modConfig;
    }

    const postInstallCall =
      /(^\s*)react_native_post_install\(\n([\s\S]*?^\1\))/m;
    const match = contents.match(postInstallCall);

    if (!match) {
      throw new Error(
        'Unable to configure iOS framework signing: React Native post_install hook was not found.',
      );
    }

    contents = helper + contents;
    contents = contents.replace(postInstallCall, (call, indentation) => {
      return `${call}\n${indentation}nm_add_framework_signing_phase(installer)`;
    });

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = withIosFrameworkSigning;
module.exports.HELPER_MARKER = HELPER_MARKER;
module.exports.PHASE_NAME = PHASE_NAME;
