import { fireEvent } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { act, mount, norm, settle, snap } from './harness';

type Page = Awaited<ReturnType<typeof mount>>;

/** Click a Link: asserts it is a real anchor and that the click is intercepted. */
async function follow(page: Page, name: string | RegExp, href: string) {
  const a = page.getByRole('link', { name }) as HTMLAnchorElement;
  expect(a.tagName).toBe('A');
  expect(a.getAttribute('href')).toBe(href);
  let proceeded = true;
  await act.fire(() => { proceeded = fireEvent.click(a, { button: 0 }); });
  expect(proceeded, `default of click on <a href="${href}"> not prevented`).toBe(false);
  return a;
}

const view = (page: Page) => norm(page.container.querySelector('.view')!.textContent);

const cls = (el: Element | null) => el?.getAttribute('class');

async function popstate(fn: () => void, ms = 0) {
  await act.fire(fn, 20 + ms);
  snap('pop');
}

describe('router/overview', () => {
  it('will navigate in memory between routes and params', async () => {
    const page = await mount('router/overview');
    expect(view(page)).toBe('Welcome. Pick a link - navigation is in-memory here.');

    await follow(page, 'About', '/about');
    expect(view(page)).toBe('Each view is its own Component, matched by its Route.');

    await follow(page, 'New user', '/user/new');
    expect(view(page)).toBe('Create a user.');

    await follow(page, 'User', '/user/ada');
    expect(view(page)).toBe('Param name = ada');
    expect(page.container.querySelector('.view b')!.textContent).toBe('ada');

    await follow(page, 'Missing', '/missing');
    expect(view(page)).toBe('No page matches this URL.');

    await follow(page, 'Home', '/');
    expect(view(page)).toBe('Welcome. Pick a link - navigation is in-memory here.');

    expect(location.pathname).toBe('/');
  });

  it('will not intercept a modified click', async () => {
    const page = await mount('router/overview');
    const a = page.getByRole('link', { name: 'About' });
    let routerPrevented: boolean | undefined;
    const spy = (e: Event) => { routerPrevented = e.defaultPrevented; e.preventDefault(); };
    document.addEventListener('click', spy);
    await act.fire(() => { fireEvent.click(a, { button: 0, metaKey: true }); });
    document.removeEventListener('click', spy);
    expect(routerPrevented).toBe(false);
    expect(view(page)).toBe('Welcome. Pick a link - navigation is in-memory here.');
  });
});

describe('router/browser', () => {
  it('will follow links, persist layout, and walk history', async () => {
    const page = await mount('router/browser');
    const address = () => page.container.querySelector('.address')!.textContent;
    expect(address()).toBe('/');
    expect(view(page)).toBe('Choose a destination.');

    await follow(page, 'Projects', '/projects');
    expect(location.pathname).toBe('/projects');
    expect(address()).toBe('/projects');
    expect(view(page)).toBe('ProjectsSelect a project.');
    const layout = page.container.querySelector('.project');

    await follow(page, 'Ada', '/projects/ada');
    expect(location.pathname).toBe('/projects/ada');
    expect(view(page)).toBe('ProjectsProject: ada');
    expect(page.container.querySelector('.project')).toBe(layout);

    await follow(page, 'Section miss', '/projects/ada/files');
    expect(view(page)).toBe('ProjectsNo project page matches this URL.');
    expect(page.container.querySelector('.project')).toBe(layout);

    await follow(page, 'App miss', '/elsewhere');
    expect(address()).toBe('/elsewhere');
    expect(view(page)).toBe('No application page matches this URL.');

    await popstate(() => history.back(), 50);
    expect(location.pathname).toBe('/projects/ada/files');
    expect(address()).toBe('/projects/ada/files');
    expect(view(page)).toBe('ProjectsNo project page matches this URL.');

    await popstate(() => history.back(), 50);
    expect(location.pathname).toBe('/projects/ada');
    expect(view(page)).toBe('ProjectsProject: ada');

    await popstate(() => history.forward(), 50);
    expect(location.pathname).toBe('/projects/ada/files');
    expect(view(page)).toBe('ProjectsNo project page matches this URL.');

    await follow(page, 'Home', '/');
    expect(address()).toBe('/');
    expect(view(page)).toBe('Choose a destination.');
  });
});

describe('router/params', () => {
  it('will swap params in place and remount on re-entry', async () => {
    const page = await mount('router/params');
    expect(view(page)).toBe('Pick Docs above to enter a section with a param.');

    await follow(page, 'Docs', '/docs/intro');
    const h2 = () => page.container.querySelector('.section h2')!.textContent;
    const instance = () => Number(/#(\d+)/.exec(page.container.querySelector('.section small')!.textContent!)![1]);
    const section = page.container.querySelector('.section');
    expect(page.container.querySelector('.section header')!.textContent).toBe('docs section');
    expect(h2()).toBe('intro');
    const first = instance();

    await act.click(page.getByRole('button', { name: 'install' }));
    expect(h2()).toBe('install');
    expect(instance()).toBe(first);
    expect(page.container.querySelector('.section')).toBe(section);

    await act.click(page.getByRole('button', { name: 'api' }));
    expect(h2()).toBe('api');
    expect(instance()).toBe(first);

    await follow(page, 'Home', '/');
    expect(view(page)).toBe('Pick Docs above to enter a section with a param.');

    await follow(page, 'Docs', '/docs/intro');
    expect(h2()).toBe('intro');
    expect(instance()).toBe(first + 1);
  });
});

describe('router/query', () => {
  it('will filter and sort via query and walk back through it', async () => {
    const page = await mount('router/query');
    const titles = () => [...page.container.querySelectorAll('.books li')].map(li => li.firstChild!.textContent!.trim());
    const url = () => page.container.querySelector('footer code')!.textContent;
    const btn = (name: string) => page.getByRole('button', { name });

    expect(url()).toBe('/');
    expect(titles()).toEqual(['Analysis I', 'Concrete Mathematics', 'Structure and Interpretation']);

    await act.click(btn('Sort year'));
    expect(url()).toBe('/?sort=year');
    expect(titles()).toEqual(['Structure and Interpretation', 'Concrete Mathematics', 'Analysis I']);

    await act.click(btn('Only math'));
    expect(url()).toBe('/?sort=year&tag=math');
    expect(titles()).toEqual(['Concrete Mathematics', 'Analysis I']);

    await act.click(btn('Clear tag'));
    expect(url()).toBe('/?sort=year');
    expect(titles()).toHaveLength(3);

    await act.click(btn('Back'));
    expect(url()).toBe('/?sort=year&tag=math');
    expect(titles()).toEqual(['Concrete Mathematics', 'Analysis I']);

    await act.click(btn('Back'));
    expect(url()).toBe('/?sort=year');

    await act.click(btn('Sort title'));
    expect(url()).toBe('/?sort=title');
    expect(titles()).toEqual(['Analysis I', 'Concrete Mathematics', 'Structure and Interpretation']);

    expect(location.search).toBe('');
  });
});

describe('router/guards', () => {
  it('will redirect, admit, hold, and cede to none', async () => {
    const page = await mount('router/guards');
    expect(view(page)).toBe('Signed out - Sign in');

    await follow(page, 'Charter', '/vault/charter');
    await settle(50);
    expect(view(page)).toBe('The guard sent you here. Sign in from the lobby, then try the vault again.');

    await follow(page, 'Secrets', '/vault/secrets');
    await settle(50);
    expect(view(page)).toMatch(/^The guard sent you here/);

    await follow(page, 'Lobby', '/');
    await act.click(page.getByRole('button', { name: 'Sign in' }));
    expect(view(page)).toBe('Signed in as Ada - Sign out');

    await follow(page, 'Charter', '/vault/charter');
    await settle(100);
    expect.soft(view(page)).toBe('Signed in as Ada - Sign out');
    expect.soft(page.queryByText('checking…')).toBeNull();
    await settle(700);
    snap('admitted');
    expect(view(page)).toBe('Reading charter');
    expect(cls(page.container.querySelector('.view p'))).toBe('doc');

    await follow(page, 'Secrets', '/vault/secrets');
    await settle(100);
    expect.soft(view(page)).toBe('Reading charter');
    await settle(700);
    snap('ceded');
    expect(view(page)).toBe('No such document in the vault.');

    await follow(page, 'Outside vault', '/missing');
    expect(view(page)).toBe('No application page matches this URL.');

    await follow(page, 'Lobby', '/');
    await act.click(page.getByRole('button', { name: 'Sign out' }));
    expect(view(page)).toBe('Signed out - Sign in');
  });
});

describe('router/transitions', () => {
  it('will hold the screen when deferred and flash the fallback when urgent', async () => {
    const page = await mount('router/transitions');
    const address = () => page.container.querySelector('.address')!.textContent;
    const bar = () => page.container.querySelector('.bar')!;
    const box = page.getByRole('checkbox') as HTMLInputElement;

    expect(address()).toBe('museum.example/');
    expect(view(page)).toBe('FoyerPick a wing. Each one is behind a slow door.');
    expect(bar().hasAttribute('data-busy')).toBe(false);
    expect(box.checked).toBe(true);

    await follow(page, 'Paintings', '/paintings');
    await settle(100);
    snap('holding');
    expect.soft(address()).toBe('museum.example/');
    expect.soft(view(page)).toMatch(/^Foyer/);
    expect.soft(bar().hasAttribute('data-busy')).toBe(true);
    expect.soft(page.queryByText('unlocking…')).toBeNull();
    await settle(800);
    snap('arrived');
    expect(address()).toBe('museum.example/paintings');
    expect(view(page)).toBe('PaintingsThe paintings wing, fully loaded.');
    expect(cls(page.container.querySelector('.view section'))).toBe('room rose');
    expect(bar().hasAttribute('data-busy')).toBe(false);

    await act.check(box);
    expect(box.checked).toBe(false);

    await follow(page, 'Sculpture', '/sculpture');
    await settle(100);
    snap('urgent');
    expect(address()).toBe('museum.example/sculpture');
    expect(view(page)).toBe('unlocking…');
    expect(cls(page.container.querySelector('.view p'))).toBe('gate');
    await settle(800);
    snap('urgent arrived');
    expect(view(page)).toBe('SculptureThe sculpture wing, fully loaded.');
    expect(cls(page.container.querySelector('.view section'))).toBe('room gold');
    expect(bar().hasAttribute('data-busy')).toBe(false);

    await act.check(box);
    expect(box.checked).toBe(true);

    await follow(page, 'Archives', '/archives');
    await settle(100);
    expect.soft(view(page)).toMatch(/^Sculpture/);
    expect.soft(address()).toBe('museum.example/sculpture');
    await settle(800);
    expect(view(page)).toBe('ArchivesThe archives wing, fully loaded.');
    expect(cls(page.container.querySelector('.view section'))).toBe('room teal');
  });
});

describe('router/nav', () => {
  it('will render a menu from the route tree and mark the active tab', async () => {
    const page = await mount('router/nav');
    const tab = (name: string) => page.getByRole('link', { name });
    const tabs = () => [...page.container.querySelectorAll('.menu a')].map(a => `${a.textContent}:${cls(a)}`);

    expect([...page.container.querySelectorAll('.group h4')].map(h => h.textContent)).toEqual(['Guides', 'Reference']);
    expect(tabs()).toEqual(['Home:tab here', 'Getting started:tab', 'Deploying:tab', 'API:tab']);
    expect(tab('Getting started').getAttribute('href')).toBe('/guides/start');
    expect(view(page)).toBe('Pick anything in the menu.');

    await follow(page, 'Getting started', '/guides/start');
    expect(view(page)).toBe('Getting started/guides/start');
    expect(tabs()).toEqual(['Home:tab near', 'Getting started:tab here', 'Deploying:tab', 'API:tab']);

    await follow(page, 'API', '/reference/api');
    expect(view(page)).toBe('API/reference/api');
    expect(tabs()).toEqual(['Home:tab near', 'Getting started:tab', 'Deploying:tab', 'API:tab here']);

    await follow(page, 'Home', '/');
    expect(tabs()).toEqual(['Home:tab here', 'Getting started:tab', 'Deploying:tab', 'API:tab']);
    expect(location.pathname).toBe('/');
  });
});

describe('router/wizard', () => {
  it('will gate steps with guards and complete the application', async () => {
    const page = await mount('router/wizard');
    const steps = () => [...page.container.querySelectorAll('.steps button')].map(b => `${norm(b.textContent)}:${cls(b)}`);
    const btn = (name: string) => page.getByRole('button', { name }) as HTMLButtonElement;
    const card = () => norm(page.container.querySelector('.card')!.textContent);

    expect(steps()).toEqual(['1 Name:step here', '2 Details:step', '3 Review:step']);
    expect(btn('Back').disabled).toBe(true);
    const name = page.getByPlaceholderText('Ada Lovelace') as HTMLInputElement;
    expect(name.value).toBe('');

    await act.click(btn('Continue'));
    expect(steps()[0]).toBe('1 Name:step here');
    expect(page.getByPlaceholderText('Ada Lovelace')).toBeTruthy();

    await act.click(btn('3 Review'));
    expect(steps()[0]).toBe('1 Name:step here');

    await act.type(page.getByPlaceholderText('Ada Lovelace'), 'Ada');
    expect((page.getByPlaceholderText('Ada Lovelace') as HTMLInputElement).value).toBe('Ada');
    await act.click(btn('Continue'));
    expect(steps()).toEqual(['1 Name:step past', '2 Details:step here', '3 Review:step']);
    expect(btn('Back').disabled).toBe(false);

    await act.click(btn('3 Review'));
    expect(steps()[1]).toBe('2 Details:step here');

    await act.click(btn('Back'));
    expect((page.getByPlaceholderText('Ada Lovelace') as HTMLInputElement).value).toBe('Ada');
    await act.click(btn('Continue'));

    await act.type(page.getByPlaceholderText('ada@analytical.engine'), 'ada@example.com');
    await act.click(btn('Continue'));
    expect(steps()).toEqual(['1 Name:step past', '2 Details:step past', '3 Review:step here']);
    expect(card()).toBe('NameAdaEmailada@example.comEverything above is correct.BackSubmit');
    expect(btn('Submit').disabled).toBe(true);

    const agree = page.getByRole('checkbox') as HTMLInputElement;
    await act.check(agree);
    expect(agree.checked).toBe(true);
    expect(btn('Submit').disabled).toBe(false);

    await act.click(btn('Submit'));
    expect(card()).toBe('Application received. Thanks, Ada!Start over');
    expect(steps()).toEqual(['1 Name:step past', '2 Details:step past', '3 Review:step past']);

    await act.click(btn('Start over'));
    expect(steps()).toEqual(['1 Name:step here', '2 Details:step', '3 Review:step']);
    expect((page.getByPlaceholderText('Ada Lovelace') as HTMLInputElement).value).toBe('');

    await act.click(btn('2 Details'));
    expect(steps()[0]).toBe('1 Name:step here');
  });
});

