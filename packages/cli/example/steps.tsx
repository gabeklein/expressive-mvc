/* Demo: animated multi-step progress. Run with `bun example/steps.tsx`. */
import { Component, Panel, Progress, Spinner, Text, render } from '@expressive/cli';

const STEPS = ['Build packages', 'Run tests', 'Publish release'];

class Task extends Component {
  label = '';
  active = false;
  done = false;

  render() {
    const icon = this.done ? (
      <Text color="green">✔</Text>
    ) : this.active ? (
      <Text color="yellow"><Spinner /></Text>
    ) : (
      <Text dim>·</Text>
    );

    return (
      <>
        {' '}{icon} <Text dim={!this.active && !this.done}>{this.label}</Text>{'\n'}
      </>
    );
  }
}

class Deploy extends Component {
  finished = 0;

  new() {
    const timer = setInterval(() => {
      if (++this.finished < STEPS.length) return;
      clearInterval(timer);
      setTimeout(() => {
        app.unmount();
        process.exit(0);
      }, 400);
    }, 1200);

    return () => clearInterval(timer);
  }

  render() {
    return (
      <Panel title="Deploy" padding={1}>
        {STEPS.map((label, i) => (
          <Task
            key={label}
            label={label}
            done={i < this.finished}
            active={i == this.finished}
          />
        ))}
        {'\n '}
        <Progress value={this.finished / STEPS.length} width={26} />
      </Panel>
    );
  }
}

const app = render(<Deploy />);
