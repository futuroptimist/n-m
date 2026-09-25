const fs = require('node:fs');
const path = require('node:path');

const iosDirectory = path.resolve(process.argv[2] || 'ios');
const podfilePath = path.join(iosDirectory, 'Podfile');

if (!fs.existsSync(podfilePath)) {
  console.error(
    `Missing ${podfilePath}. Generate it first with: npx expo prebuild --platform ios`,
  );
  process.exit(1);
}

const podfile = fs.readFileSync(podfilePath, 'utf8');
const requiredPodfileFragments = [
  '# n-m: ensure embedded frameworks are signed for physical devices',
  'nm_add_framework_signing_phase(installer)',
  '[n-m] Sign Embedded Frameworks',
  'EXPANDED_CODE_SIGN_IDENTITY',
  '/usr/bin/codesign --force --sign',
  "-name '*.framework'",
  'target.build_phases.move(phase, target.build_phases.length - 1)',
];

for (const fragment of requiredPodfileFragments) {
  if (!podfile.includes(fragment)) {
    console.error(
      `Generated Podfile is missing framework-signing configuration: ${fragment}`,
    );
    process.exit(1);
  }
}

const projectFiles = fs.existsSync(iosDirectory)
  ? fs
      .readdirSync(iosDirectory)
      .filter((entry) => entry.endsWith('.xcodeproj'))
      .map((entry) => path.join(iosDirectory, entry, 'project.pbxproj'))
  : [];

for (const projectFile of projectFiles) {
  const project = fs.readFileSync(projectFile, 'utf8');
  const embedIndex = project.lastIndexOf('[CP] Embed Pods Frameworks');
  const signingIndex = project.lastIndexOf('[n-m] Sign Embedded Frameworks');

  // CocoaPods materializes both phases during pod install. A prebuild run on a
  // host without CocoaPods still verifies the generated Podfile above.
  if (embedIndex >= 0 && (signingIndex < 0 || signingIndex < embedIndex)) {
    console.error(
      "The framework-signing phase must exist after CocoaPods' framework-embed phase.",
    );
    process.exit(1);
  }
}

console.log('Generated iOS framework-signing configuration is valid.');
