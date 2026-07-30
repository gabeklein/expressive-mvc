import './App.css';

import Button from '@common/Button';
import { Component, get, has, ref } from '@expressive/react';

export default () => (
  <div className="container">
    <Demo />
  </div>
);

class Demo extends Component {
  showing = true;
  entries = has<string>();

  log(note: string) {
    this.entries.push(note);
  }

  render() {
    const { showing, entries } = this;

    return (
      <>
        {showing && <Probe />}

        <div className="row">
          <Button primary onClick={() => (this.showing = !showing)}>
            {showing ? 'Unmount' : 'Mount'}
          </Button>
          <Button onClick={() => entries.clear()}>Clear</Button>
        </div>

        <ol className="trace">
          {entries.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ol>
      </>
    );
  }
}

class Probe extends Component {
  demo = get(Demo);

  width = 0;
  ticks = 0;

  protected new() {
    this.demo.log('new() · constructed');
    return () => this.demo.log('new() cleanup · destroyed');
  }

  mount() {
    this.demo.log('mount() · committed');

    const measure = () => (this.width = window.innerWidth);
    const timer = setInterval(() => this.ticks++, 1000);

    measure();
    window.addEventListener('resize', measure);

    return () => {
      this.demo.log('mount() cleanup · unmounted');
      clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }

  box = ref<HTMLDivElement>(() => {
    this.demo.log('ref() · element attached');
    return () => this.demo.log('ref() · element detached');
  });

  render() {
    const { width, ticks } = this;

    return (
      <div className="probe" ref={this.box}>
        <strong>{width}px</strong>
        <small>alive {ticks}s</small>
      </div>
    );
  }
}
