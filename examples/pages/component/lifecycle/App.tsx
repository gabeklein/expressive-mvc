import './App.css';

import Button from '@common/Button';
import { Component, get, ref } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Lifecycle</h1>
    <p>
      Three seams, three phases: <code>new()</code> at construction,{' '}
      <code>mount()</code> at commit, <code>ref()</code> when an element
      attaches. Toggle the probe to watch each one fire and unwind.
    </p>
    <Demo />
  </div>
);

class Demo extends Component {
  showing = true;
  entries: string[] = [];

  log(note: string) {
    this.entries = [...this.entries, note];
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
          <Button onClick={() => (this.entries = [])}>Clear</Button>
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
  // The transcript belongs to the demo, which outlives this probe - so its own
  // teardown still has somewhere to write.
  demo = get(Demo);

  width = 0;
  ticks = 0;

  // Construction. Synchronous, and it runs during server render too, so keep
  // it to setup that belongs to the instance itself.
  protected new() {
    this.demo.log('new() · constructed');
    return () => this.demo.log('new() cleanup · destroyed');
  }

  // Commit, client only. Timers, listeners and anything reaching for `window`
  // belong here - never in new().
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

  // A ref fires when its element attaches and cleans up when it detaches -
  // a third seam, independent of both hooks above.
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
