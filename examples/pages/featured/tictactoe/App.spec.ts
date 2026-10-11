import { expect, test } from '../../../e2e';

test('will play to a win, reset and draw', async ({ page, open }) => {
  await open('featured/tictactoe');
  const status = page.locator('.status');
  const board = page.locator('.board');
  const cells = board.getByRole('button');
  const reset = page.getByRole('button', { name: 'New game' });
  const play = async (...moves: number[]) => {
    for (const i of moves) await cells.nth(i).click();
  };

  await expect(cells).toHaveCount(9);
  await expect(status).toHaveText("X's turn");
  await expect(board).toHaveClass('board');

  await play(0);
  await expect(status).toHaveText("O's turn");
  await expect(cells.nth(0)).toHaveText('X');
  await expect(cells.nth(0)).toHaveClass(/\bX\b/);

  await play(0);
  await expect(status).toHaveText("O's turn");
  await expect(cells.nth(0)).toHaveText('X');

  await play(3, 1, 4, 2);
  await expect(status).toHaveText('X wins!');
  await expect(board).toHaveClass('board done');
  await expect(board.locator('button.wins')).toHaveCount(3);
  for (const i of [0, 1, 2]) await expect(cells.nth(i)).toHaveClass(/\bwins\b/);

  await play(8);
  await expect(cells.nth(8)).toHaveText('');
  await expect(status).toHaveText('X wins!');

  await reset.click();
  await expect(status).toHaveText("X's turn");
  await expect(cells).toHaveText(Array(9).fill(''));
  await expect(board).toHaveClass('board');
  await expect(board.locator('button.wins')).toHaveCount(0);

  await play(0, 1, 2, 4, 3, 5, 7, 6, 8);
  await expect(cells).toHaveText(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']);
  await expect(status).toHaveText('Draw!');
  await expect(board).toHaveClass('board');

  await reset.click();
  await expect(status).toHaveText("X's turn");
});
