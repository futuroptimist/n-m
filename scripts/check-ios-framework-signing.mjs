import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

try {
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

  const project = await readFile(
    path.join(temporaryRoot, 'ios', 'nm.xcodeproj', 'project.pbxproj'),
    'utf8',
  );
  const podfile = await readFile(
    path.join(temporaryRoot, 'ios', 'Podfile'),
    'utf8',
  );

  assert.match(project, /\[n-m\] Sign Embedded Frameworks/);
  assert.match(project, /EXPANDED_CODE_SIGN_IDENTITY/);
  assert.ok(project.includes("name '*.framework'"));
  assert.match(project, /alwaysOutOfDate = 1/);
  assert.match(
    podfile,
    /n-m: keep framework signing after CocoaPods embedding/,
  );
  assert.match(podfile, /\[CP\] Embed Pods Frameworks/);

  const hook = podfile.slice(
    podfile.indexOf('# n-m: keep framework signing after CocoaPods embedding'),
  );
  const rubyHarness = String.raw`
Phase = Struct.new(:name)
Target = Struct.new(:build_phases) do
  def shell_script_build_phases = build_phases
end
class Project
  attr_reader :targets, :saved
  def initialize(targets)
    @targets = targets
    @saved = false
  end
  def save = @saved = true
end
AggregateTarget = Struct.new(:user_project)
Installer = Struct.new(:aggregate_targets)

$post_integrate_hook = nil
def post_integrate(&hook) = $post_integrate_hook = hook
eval(STDIN.read, binding, 'generated Podfile signing hook')

signing = Phase.new('[n-m] Sign Embedded Frameworks')
embedding = Phase.new('[CP] Embed Pods Frameworks')
other = Phase.new('Other phase')
target = Target.new([signing, other, embedding])
project = Project.new([target])
$post_integrate_hook.call(Installer.new([AggregateTarget.new(project)]))

names = target.build_phases.map(&:name)
expected = ['Other phase', '[CP] Embed Pods Frameworks', '[n-m] Sign Embedded Frameworks']
abort "unexpected build phase order: #{names.inspect}" unless names == expected
abort 'project was not saved' unless project.saved
`;
  const rubyResult = spawnSync('ruby', ['-e', rubyHarness], {
    encoding: 'utf8',
    input: hook,
  });
  assertSpawnSucceeded(rubyResult, 'Generated Podfile ordering hook check');

  console.log(
    'Generated iOS project signs embedded frameworks after CocoaPods embedding.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
