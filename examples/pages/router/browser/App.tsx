import './App.css';

import '@expressive/react';
import { BrowserRouter, Link, Route } from '@expressive/router';
import type { ReactNode } from 'react';

export default () => (
  <div className="container">
    <h1>Browser history</h1>
    <p>
      <code>BrowserRouter</code> binds the router to the address bar and browser
      history. A nested <code>none</code> Route catches misses inside its section;
      the root one catches the rest.
    </p>
    <BrowserRouter>
      <Route as={Frame}>
        <Route as={Home} />
        <Route to="projects" as={Projects}>
          <Route as={ProjectIndex} />
          <Route to=":id" as={Project} />
          <Route none as={ProjectNotFound} />
        </Route>
        <Route none as={NotFound} />
      </Route>
    </BrowserRouter>
    <small>
      Reload or use the browser's Back and Forward - the URL stays the source of
      truth. The projects layout persists across every page
      below <code>/projects</code>, its own not-found page included.
    </small>
  </div>
);

const Frame = (props: { children?: ReactNode }) => {
  const { url } = BrowserRouter.get();

  return (
    <section className="browser">
      <code className="address">{url}</code>
      <nav className="nav">
        <Link to="/">Home</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/projects/ada">Ada</Link>
        <Link to="/projects/ada/files">Section miss</Link>
        <Link to="/elsewhere">App miss</Link>
      </nav>
      <div className="view">{props.children}</div>
    </section>
  );
};

const Home = () => <p>Choose a destination.</p>;

const Projects = (props: { children?: ReactNode }) => (
  <section className="project">
    <b>Projects</b>
    {props.children}
  </section>
);

const ProjectIndex = () => <p>Select a project.</p>;

const Project = () => {
  const { match } = Route.get(true);

  return <p>Project: {match!.id}</p>;
};

const ProjectNotFound = () => <p>No project page matches this URL.</p>;

const NotFound = () => <p>No application page matches this URL.</p>;
