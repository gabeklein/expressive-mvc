/** @jsxImportSource @expressive/dom */
import { render } from '@expressive/dom';

const pages = import.meta.glob('../pages-dom/**/App.tsx');
const page = new URLSearchParams(location.search).get('page')!;
const { default: App } = (await pages[`../pages-dom/${page}/App.tsx`]()) as any;

render(<App />, document.getElementById('root')!);
(window as any).__ready = true;
