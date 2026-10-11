import { expect, test } from '../../../e2e';

test('will filter, select and show detail across three classes', async ({ page, open }) => {
  await open('composition/concerns');
  const hits = page.locator('.results li');
  const hit = (title: string) => hits.filter({ hasText: title });
  const tag = (name: string) => page.getByRole('button', { name, exact: true });
  const detail = page.locator('.detail');
  const search = page.getByPlaceholder('Search titles');

  await expect(hits).toHaveText([
    'Analysis I',
    'Structure and Interpretation',
    'Concrete Mathematics',
    'The Art of Computer Programming'
  ]);
  await expect(tag('all')).toHaveClass('tag on');
  await expect(tag('math')).toHaveClass('tag');
  await expect(detail).toHaveText('no book selected');

  await tag('math').click();
  await expect(tag('math')).toHaveClass('tag on');
  await expect(tag('all')).toHaveClass('tag');
  await expect(hits).toHaveText(['Analysis I', 'Concrete Mathematics']);

  await hit('Concrete Mathematics').click();
  await expect(hit('Concrete Mathematics')).toHaveClass('hit on');
  await expect(hit('Analysis I')).toHaveClass('hit');
  await expect(detail).toHaveText('Concrete Mathematics');

  await search.fill('anal');
  await expect(hits).toHaveText(['Analysis I']);
  await expect(detail).toHaveText('Concrete Mathematics');

  await search.fill('zzz');
  await expect(hits).toHaveText(['nothing matches']);
  await expect(hits).toHaveClass(['empty']);

  await tag('code').click();
  await search.fill('');
  await expect(hits).toHaveText(['Structure and Interpretation', 'The Art of Computer Programming']);

  await hit('The Art of Computer Programming').click();
  await expect(detail).toHaveText('The Art of Computer Programming');
  await expect(hit('The Art of Computer Programming')).toHaveClass('hit on');

  await tag('all').click();
  await expect(hits).toHaveCount(4);
  await expect(hit('The Art of Computer Programming')).toHaveClass('hit on');
  await expect(hit('Concrete Mathematics')).toHaveClass('hit');
});
