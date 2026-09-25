require 'json'

Phase = Struct.new(:name)

class Target
  attr_reader :build_phases

  def initialize(names)
    @build_phases = names.map { |name| Phase.new(name) }
  end

  def shell_script_build_phases = build_phases
end

class Project
  attr_reader :targets

  def self.load(path)
    new(path, JSON.parse(File.read(path)).fetch('build_phases'))
  end

  def initialize(path, names)
    @path = path
    @targets = [Target.new(names)]
  end

  def save
    File.write(@path, JSON.generate(build_phases: targets.first.build_phases.map(&:name)))
  end
end

AggregateTarget = Struct.new(:user_project)
Installer = Struct.new(:aggregate_targets)

$post_integrate_hook = nil
def post_integrate(&hook) = $post_integrate_hook = hook

eval(STDIN.read, binding, 'generated Podfile signing hook')
abort 'post_integrate hook was not registered' unless $post_integrate_hook

fixture_path = File.join(ARGV.fetch(0), 'ordering-project.json')
initial_names = [
  '[n-m] Sign Embedded Frameworks',
  'Sources',
  '[CP] Embed Pods Frameworks',
  'Resources'
]
File.write(fixture_path, JSON.generate(build_phases: initial_names))

2.times do
  project = Project.load(fixture_path)
  installer = Installer.new([AggregateTarget.new(project)])
  $post_integrate_hook.call(installer)

  saved_names = Project.load(fixture_path).targets.first.build_phases.map(&:name)
  signing_indices = saved_names.each_index.select do |index|
    saved_names[index] == '[n-m] Sign Embedded Frameworks'
  end
  embed_index = saved_names.index('[CP] Embed Pods Frameworks')

  abort "unexpected signing phases: #{saved_names.inspect}" unless signing_indices.length == 1
  abort "signing does not follow embedding: #{saved_names.inspect}" unless signing_indices.first == embed_index + 1
end
