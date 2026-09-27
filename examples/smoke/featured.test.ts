import { fireEvent } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { act, mount, norm, settle, snap } from './harness';

function transfer() {
  const data = new Map<string, string>();
  return {
    data,
    dropEffect: 'move',
    effectAllowed: 'all',
    files: [],
    items: [],
    types: [] as string[],
    setData(type: string, value: string) { data.set(type, value); },
    getData(type: string) { return data.get(type) ?? ''; },
    clearData() { data.clear(); },
    setDragImage() {}
  };
}

// happy-dom has no HTMLElement.draggable property, so dom falls back to setAttribute(name, '') for true.
const draggable = (el: Element) => {
  const attr = el.getAttribute('draggable');
  return attr !== null && attr !== 'false';
};

async function drag(source: Element, target: Element) {
  const dataTransfer = transfer();
  await act.fire(() => fireEvent.dragStart(source, { dataTransfer }));
  await act.fire(() => fireEvent.dragEnter(target, { dataTransfer }));
  await act.fire(() => fireEvent.dragOver(target, { dataTransfer }));
  return {
    drop: () => act.fire(() => {
      fireEvent.drop(target, { dataTransfer });
      fireEvent.dragEnd(source, { dataTransfer });
    })
  };
}

describe('featured/forms', () => {
  it('will bind inputs, preview values and submit', async () => {
    const page = await mount('featured/forms');
    const first = page.getByPlaceholderText('Firstname') as HTMLInputElement;
    const last = page.getByPlaceholderText('Lastname') as HTMLInputElement;
    const email = page.getByPlaceholderText('Email Address') as HTMLInputElement;
    const pre = page.container.querySelector('pre')!;
    const preview = () => JSON.parse(pre.textContent!);

    expect(page.getByRole('heading').textContent).toBe('Example Form');
    expect([first.name, last.name, email.name]).toEqual(['firstname', 'lastname', 'email']);
    expect(preview()).toMatchObject({ firstname: '', lastname: '', email: '' });

    await act.click(page.getByText('Submit'));
    expect((window as any).alerts).toEqual(['Please fill out all fields']);

    await act.type(first, 'Ada');
    expect(preview()).toMatchObject({ firstname: 'Ada', lastname: '', email: '' });

    await act.type(last, 'Lovelace');
    await act.type(email, 'ada@example.com');
    expect(preview()).toMatchObject({ firstname: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' });

    await act.click(page.getByText('Submit'));
    expect((window as any).alerts).toEqual([
      'Please fill out all fields',
      'Submitting Ada Lovelace with email ada@example.com'
    ]);

    await act.type(first, '');
    expect(preview().firstname).toBe('');
    expect(first.value).toBe('');
  });
});

describe('featured/spreadsheet', () => {
  it('will edit cells and recompute formulas', async () => {
    const page = await mount('featured/spreadsheet');
    const table = page.container.querySelector('table')!;
    const cols = [...table.querySelectorAll('thead th')].map(th => th.textContent);
    expect(cols).toEqual(['', 'A', 'B', 'C', 'D']);
    expect(table.querySelectorAll('tbody tr').length).toBe(5);

    const td = (id: string) => {
      const col = 'ABCD'.indexOf(id[0]);
      const row = Number(id.slice(1)) - 1;
      return table.querySelectorAll('tbody tr')[row].querySelectorAll('td')[col];
    };
    const shown = (id: string) => norm(td(id).textContent);
    const editor = (id: string) => td(id).querySelector('input');

    async function enter(id: string, value: string, finish: 'Enter' | 'Escape' | 'blur' = 'Enter') {
      await act.click(td(id).querySelector('.cell')!);
      const input = editor(id)!;
      expect(input).toBeTruthy();
      expect(document.activeElement).toBe(input);
      await act.type(input, value);
      expect(editor(id)!.value).toBe(value);
      if (finish == 'blur') await act.blur(input);
      else await act.key(input, finish);
      expect(editor(id)).toBeNull();
    }

    expect(td('A1').querySelector('.cell')).toBeTruthy();
    expect(shown('A1')).toBe('');

    await enter('A1', '5');
    expect(shown('A1')).toBe('5');

    await enter('B1', '=A1*2+C1');
    expect(shown('B1')).toBe('10');

    await enter('C1', '3', 'Escape');
    expect(shown('C1')).toBe('3');
    expect(shown('B1')).toBe('13');

    await enter('A1', '7', 'blur');
    expect(shown('A1')).toBe('7');
    expect(shown('B1')).toBe('17');

    await enter('B2', '=B1/2');
    expect(shown('B2')).toBe('8.5');

    await enter('A1', '1');
    expect(shown('B1')).toBe('5');
    expect(shown('B2')).toBe('2.5');

    await enter('D5', 'hello');
    expect(shown('D5')).toBe('hello');

    await enter('D4', '=foo');
    expect(shown('D4')).toBe('#ERR');

    await enter('D3', '=D5+1');
    expect(shown('D3')).toBe('1');

    await act.click(td('A1').querySelector('.cell')!);
    expect(editor('A1')!.value).toBe('1');
    await act.key(editor('A1')!, 'Enter');
  });
});

describe('featured/tictactoe', () => {
  it('will play to a win, reset and draw', async () => {
    const page = await mount('featured/tictactoe');
    const status = () => page.container.querySelector('.status')!.textContent;
    const board = page.container.querySelector('.board')!;
    const cells = () => [...board.querySelectorAll('button')];
    const marks = () => cells().map(b => b.textContent).join(',');
    const play = async (...moves: number[]) => {
      for (const i of moves) await act.click(cells()[i]);
    };

    expect(cells().length).toBe(9);
    expect(status()).toBe("X's turn");
    expect(board.className).toBe('board');

    await play(0);
    expect(status()).toBe("O's turn");
    expect(cells()[0].textContent).toBe('X');
    expect(cells()[0].classList.contains('X')).toBe(true);

    await play(0);
    expect(status()).toBe("O's turn");
    expect(cells()[0].textContent).toBe('X');

    await play(3, 1, 4, 2);
    expect(status()).toBe('X wins!');
    expect(board.className).toBe('board done');
    expect(cells().map(b => b.classList.contains('wins'))).toEqual(
      [true, true, true, false, false, false, false, false, false]
    );

    await play(8);
    expect(cells()[8].textContent).toBe('');
    expect(status()).toBe('X wins!');

    await act.click(page.getByText('New game'));
    expect(status()).toBe("X's turn");
    expect(marks()).toBe(',,,,,,,,');
    expect(board.className).toBe('board');
    expect(cells().some(b => b.classList.contains('wins'))).toBe(false);

    await play(0, 1, 2, 4, 3, 5, 7, 6, 8);
    expect(marks()).toBe('X,O,X,X,O,O,O,X,X');
    expect(status()).toBe('Draw!');
    expect(board.className).toBe('board');

    await act.click(page.getByText('New game'));
    expect(status()).toBe("X's turn");
  });
});

describe('featured/stopwatch', () => {
  it('will start, stop and reset', async () => {
    const page = await mount('featured/stopwatch');
    const time = page.container.querySelector('.time')!;
    const toggle = page.getByText('Start');
    const reset = page.getByText('Reset') as HTMLButtonElement;

    expect(time.textContent).toBe('00:00.00');
    expect(time.classList.contains('running')).toBe(false);
    expect(reset.disabled).toBe(true);

    await act.click(toggle);
    expect(toggle.textContent).toBe('Stop');
    expect(time.classList.contains('running')).toBe(true);
    expect(reset.disabled).toBe(false);

    await settle(80);
    snap('running');
    const running = time.textContent!;
    expect(running).toMatch(/^00:00\.\d\d$/);
    expect(running).not.toBe('00:00.00');

    await act.click(toggle);
    expect(toggle.textContent).toBe('Start');
    expect(time.classList.contains('running')).toBe(false);
    const stopped = time.textContent;
    await settle(50);
    expect(time.textContent).toBe(stopped);
    expect(reset.disabled).toBe(false);

    await act.click(toggle);
    await settle(40);
    expect(time.textContent! > stopped!).toBe(true);

    await act.click(reset);
    expect(time.textContent).toBe('00:00.00');
    expect(toggle.textContent).toBe('Start');
    expect(time.classList.contains('running')).toBe(false);
    expect(reset.disabled).toBe(true);
    await settle(30);
    expect(time.textContent).toBe('00:00.00');
  });
});

describe('featured/kanban', () => {
  it('will add, rename, reorder, move and remove cards', async () => {
    const page = await mount('featured/kanban');
    const column = (label: string) =>
      [...page.container.querySelectorAll('section.column')].find(s => s.querySelector('h2')!.textContent === label)!;
    const titles = (label: string) =>
      [...column(label).querySelectorAll('li.card')].map(li => norm(li.querySelector('span')?.textContent ?? ''));
    const count = (label: string) => column(label).querySelector('.count')!.textContent;
    const card = (title: string) =>
      [...page.container.querySelectorAll('li.card')].find(li => norm(li.querySelector('span')?.textContent ?? '') === title)!;

    const labels = [...page.container.querySelectorAll('section.column h2')].map(h => h.textContent);
    expect(labels).toEqual(['To Do', 'In Progress', 'In Review', 'Done']);
    expect((column('To Do') as HTMLElement).style.getPropertyValue('--accent')).toBe('#6366f1');
    expect(titles('To Do')).toEqual(['Write the migration guide']);
    expect(titles('In Progress')).toEqual(['Wire drag and drop']);
    expect(titles('In Review')).toEqual(['Router guards']);
    expect(titles('Done')).toEqual(['Ship map + has', 'Retire hot (#263)']);
    expect(count('Done')).toBe('2');
    expect(draggable(card('Router guards'))).toBe(true);

    // add
    const draft = column('To Do').querySelector('input') as HTMLInputElement;
    await act.type(draft, 'Plan release');
    expect(draft.value).toBe('Plan release');
    await act.submit(column('To Do').querySelector('form')!);
    expect(titles('To Do')).toEqual(['Write the migration guide', 'Plan release']);
    expect(count('To Do')).toBe('2');
    expect(draft.value).toBe('');

    await act.submit(column('To Do').querySelector('form')!);
    expect(count('To Do')).toBe('2');

    // reorder within a column, before a target card
    const shipped = card('Ship map + has');
    const retire = card('Retire hot (#263)');
    const reorder = await drag(retire, shipped);
    expect(retire.classList.contains('dragging')).toBe(true);
    expect(shipped.classList.contains('over')).toBe(true);
    expect(retire.classList.contains('over')).toBe(false);
    await reorder.drop();
    expect(titles('Done')).toEqual(['Retire hot (#263)', 'Ship map + has']);
    expect(card('Retire hot (#263)')).toBe(retire);
    expect(card('Ship map + has')).toBe(shipped);
    expect(retire.classList.contains('dragging')).toBe(false);
    expect(shipped.classList.contains('over')).toBe(false);

    // move to the end of another column
    const wire = card('Wire drag and drop');
    const move = await drag(wire, column('To Do'));
    expect(column('To Do').className).toBe('column over-end');
    await move.drop();
    expect(column('To Do').className).toBe('column');
    expect(titles('To Do')).toEqual(['Write the migration guide', 'Plan release', 'Wire drag and drop']);
    expect(titles('In Progress')).toEqual([]);
    expect(count('In Progress')).toBe('0');
    expect(count('To Do')).toBe('3');
    expect(card('Wire drag and drop').className).toBe('card');

    // move before a card in another column
    const guards = card('Router guards');
    const across = await drag(guards, card('Write the migration guide'));
    await across.drop();
    expect(titles('To Do')).toEqual(['Router guards', 'Write the migration guide', 'Plan release', 'Wire drag and drop']);
    expect(titles('In Review')).toEqual([]);

    // insert between two cards
    const between = await drag(card('Wire drag and drop'), card('Plan release'));
    await between.drop();
    expect(titles('To Do')).toEqual(['Router guards', 'Write the migration guide', 'Wire drag and drop', 'Plan release']);

    // rename: double-click, autofocus, Enter commits
    await act.dblclick(card('Plan release').querySelector('span')!);
    let input = page.container.querySelector('li.card input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('Plan release');
    expect(document.activeElement).toBe(input);
    expect(draggable(input.closest('li')!)).toBe(false);
    input.value = 'Plan the release';
    await act.key(input, 'Enter');
    expect(page.container.querySelector('li.card input')).toBeNull();
    expect(titles('To Do')).toContain('Plan the release');

    // Escape cancels
    await act.dblclick(card('Plan the release').querySelector('span')!);
    input = page.container.querySelector('li.card input') as HTMLInputElement;
    input.value = 'discarded';
    await act.key(input, 'Escape');
    expect(page.container.querySelector('li.card input')).toBeNull();
    expect(titles('To Do')).toContain('Plan the release');

    // blur commits; blank keeps title
    await act.dblclick(card('Router guards').querySelector('span')!);
    input = page.container.querySelector('li.card input') as HTMLInputElement;
    input.value = '  ';
    await act.blur(input);
    expect(titles('To Do')[0]).toBe('Router guards');

    // remove
    await act.click(card('Router guards').querySelector('button[aria-label="delete"]')!);
    expect(titles('To Do')).toEqual(['Write the migration guide', 'Wire drag and drop', 'Plan the release']);
    expect(count('To Do')).toBe('3');
  });
});
