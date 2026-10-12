/* Demo: animated multi-step progress. Run with `bun example/steps.tsx`. */
import { Component, render } from '@expressive/cli';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const STEPS = ['Build packages', 'Run tests', 'Publish release'];

class Spinner extends Component {
  frame = 0;

  new() {
    const timer = setInterval(() => this.frame++, 80);
    return () => clearInterval(timer);
  }

  render() {
    return FRAMES[this.frame % FRAMES.length];
  }
}

class Task extends Component {
  label = '';
  active = false;
  done = false;

  render() {
    const icon = this.done ? '✔' : this.active ? <Spinner /> : '·';
    return <>{'  '}{icon} {this.label}{'\n'}</>;
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
      }, 300);
    }, 1200);

    return () => clearInterval(timer);
  }

  render() {
    return (
      <>
        {'Deploying:\n'}
        {STEPS.map((label, i) => (
          <Task
            key={label}
            label={label}
            done={i < this.finished}
            active={i == this.finished}
          />
        ))}
      </>
    );
  }
}

const app = render(<Deploy />);
