import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import xcode from 'xcode';

const phaseName = '[n-m] Sign Embedded Frameworks';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'nm-ios-signing-'));

function assertSpawnSucceeded(result, command) {
  assert.equal(
    result.error,
    undefined,
    `${command} could not be started: ${result.error?.message}`,
  );
  assert.equal(
    result.status,
    0,
    `${command} failed (status: ${result.status ?? 'null'}, signal: ${result.signal ?? 'none'}):\n${result.stdout}\n${result.stderr}`,
  );
}

function decodePbxString(value) {
  assert.equal(typeof value, 'string');
  assert.ok(value.startsWith('"') && value.endsWith('"'));
  return value.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
}

function signingPhaseForApplication(project) {
  const nativeTargets = project.pbxNativeTargetSection();
  const applicationTargets = Object.entries(nativeTargets).filter(
    ([key, target]) =>
      !key.endsWith('_comment') &&
      target.productType === '"com.apple.product-type.application"',
  );
  assert.equal(applicationTargets.length, 1, 'expected one application target');

  const [, applicationTarget] = applicationTargets[0];
  const phaseSection = project.hash.project.objects.PBXShellScriptBuildPhase;
  const attachedSigningPhases = applicationTarget.buildPhases
    .map(({ value }) => phaseSection[value])
    .filter((phase) => phase && decodePbxString(phase.name) === phaseName);

  assert.equal(
    attachedSigningPhases.length,
    1,
    'application target must attach exactly one framework signing phase',
  );
  return attachedSigningPhases[0];
}

function validateSigningPhase(phase) {
  assert.equal(phase.alwaysOutOfDate, 1);
  assert.equal(phase.shellPath, '/bin/sh');
  const script = decodePbxString(phase.shellScript);

  assert.match(script, /\[ "\$PLATFORM_NAME" != "iphoneos" \]/);
  assert.match(script, /\$\{CODE_SIGNING_ALLOWED:-YES\}.*= "NO"/);
  assert.match(script, /\[ -z "\$\{EXPANDED_CODE_SIGN_IDENTITY:-\}" \]/);
  assert.match(
    script,
    /find "\$frameworks_dir" -depth -type d -name '\*\.framework' -print \|/,
  );
  assert.match(script, /while IFS= read -r framework; do/);
  assert.match(
    script,
    /\/usr\/bin\/codesign --force --sign "\$EXPANDED_CODE_SIGN_IDENTITY"\s+--preserve-metadata=identifier,entitlements "\$framework"/,
  );
}

function runHookFixture(hook, fixturePath) {
  return spawnSync('ruby', [fixturePath, temporaryRoot], {
    encoding: 'utf8',
    input: hook,
  });
}

function assertSupportedRuby() {
  const result = spawnSync('ruby', ['--version'], { encoding: 'utf8' });
  assertSpawnSucceeded(
    result,
    'Ruby 2.6 or newer is required by npm run test:ios-signing; install Ruby and ensure ruby is on PATH',
  );
  const match = result.stdout.match(/ruby (\d+)\.(\d+)/);
  assert.ok(match, `could not determine Ruby version from: ${result.stdout}`);
  const [, major, minor] = match.map(Number);
  assert.ok(
    major > 2 || (major === 2 && minor >= 6),
    `npm run test:ios-signing requires Ruby 2.6 or newer (found ${result.stdout.trim()})`,
  );
}

try {
  assertSupportedRuby();

  for (const entry of ['app.json', 'package.json', 'plugins']) {
    await cp(path.join(root, entry), path.join(temporaryRoot, entry), {
      recursive: true,
    });
  }
  await symlink(
    path.join(root, 'node_modules'),
    path.join(temporaryRoot, 'node_modules'),
  );

  const expo = path.join(root, 'node_modules', '.bin', 'expo');
  const result = spawnSync(
    expo,
    ['prebuild', '--platform', 'ios', '--no-install'],
    { cwd: temporaryRoot, encoding: 'utf8' },
  );
  assertSpawnSucceeded(result, 'Expo prebuild');

  const projectPath = path.join(
    temporaryRoot,
    'ios',
    'nm.xcodeproj',
    'project.pbxproj',
  );
  const parsedProject = xcode.project(projectPath).parseSync();
  const signingPhase = signingPhaseForApplication(parsedProject);
  validateSigningPhase(signingPhase);

  const applicationTarget = Object.entries(
    parsedProject.pbxNativeTargetSection(),
  ).find(
    ([key, target]) =>
      !key.endsWith('_comment') &&
      target.productType === '"com.apple.product-type.application"',
  )[1];
  const signingReferenceIndex = applicationTarget.buildPhases.findIndex(
    ({ value }) =>
      parsedProject.hash.project.objects.PBXShellScriptBuildPhase[value] ===
      signingPhase,
  );
  const [signingReference] = applicationTarget.buildPhases.splice(
    signingReferenceIndex,
    1,
  );
  assert.throws(
    () => signingPhaseForApplication(parsedProject),
    (error) => error instanceof assert.AssertionError,
    'a detached signing phase must fail validation',
  );
  applicationTarget.buildPhases.splice(
    signingReferenceIndex,
    0,
    signingReference,
  );

  const noOpPhase = {
    ...signingPhase,
    shellScript: signingPhase.shellScript.replace(
      /\\?"?\/usr\/bin\/codesign[^\n]*/,
      ': # codesign removed',
    ),
  };
  assert.throws(
    () => validateSigningPhase(noOpPhase),
    (error) => error instanceof assert.AssertionError,
    'a no-op in place of codesign must fail validation',
  );

  const podfile = await readFile(
    path.join(temporaryRoot, 'ios', 'Podfile'),
    'utf8',
  );
  const marker = '# n-m: keep framework signing after CocoaPods embedding';
  const markerIndex = podfile.indexOf(marker);
  assert.notEqual(
    markerIndex,
    -1,
    'generated Podfile must contain ordering hook',
  );
  const hook = podfile.slice(markerIndex);
  const fixturePath = path.join(
    root,
    'scripts',
    'fixtures',
    'ios-signing-post-integrate.rb',
  );
  assertSpawnSucceeded(
    runHookFixture(hook, fixturePath),
    'Generated Podfile ordering hook check',
  );

  const incorrectlyPersistedHook = hook
    .replace(
      '  installer.aggregate_targets.map(&:user_project).uniq.each do |project|',
      '  installer.aggregate_targets.map(&:user_project).uniq.each do |project|\n    project.save # deliberately persist the pre-reorder phase order',
    )
    .replace('    project.save\n  end\nend', '  end\nend');
  assert.notEqual(
    incorrectlyPersistedHook,
    hook,
    'negative mutation must change the hook',
  );
  const negativeHookResult = runHookFixture(
    incorrectlyPersistedHook,
    fixturePath,
  );
  assert.notEqual(
    negativeHookResult.status,
    0,
    'hook validation must fail when reordered phases are not persisted',
  );

  console.log(
    'Generated application target signs embedded frameworks after CocoaPods embedding.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
