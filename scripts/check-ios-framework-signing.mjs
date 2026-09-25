import { readFile } from 'node:fs/promises';
import process from 'node:process';

const projectFile = process.argv[2];

if (!projectFile) {
  console.error(
    'Usage: npm run check:ios-signing -- <path-to-project.pbxproj>',
  );
  process.exit(2);
}

const project = await readFile(projectFile, 'utf8');
const requiredFragments = [
  '[n-m] Sign Embedded Frameworks',
  'PLATFORM_NAME',
  'iphoneos',
  'EXPANDED_CODE_SIGN_IDENTITY',
  'FRAMEWORKS_FOLDER_PATH',
  "-name '*.framework'",
  '/usr/bin/codesign --force --sign',
];
const missing = requiredFragments.filter(
  (fragment) => !project.includes(fragment),
);

if (missing.length > 0) {
  console.error(
    `Generated iOS project is missing framework-signing configuration: ${missing.join(', ')}`,
  );
  process.exit(1);
}

console.log(`Verified embedded-framework signing phase in ${projectFile}`);
