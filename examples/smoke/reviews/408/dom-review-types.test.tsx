import { it } from 'vitest';
import { State } from '@expressive/mvc';
import { Provider } from './index';

class Svc extends State {}

it('types', () => {
  // T1 svg handler narrowing
  <svg onClick={(e) => e.currentTarget.viewBox} />;
  // T2 shared handler typed on a broader element
  const onAny = (e: MouseEvent) => e.clientX;
  <button onClick={onAny} />;
  // T3 shared handler typed with HTMLElement currentTarget reused across elements
  const shared = (e: Event & { currentTarget: HTMLElement }) => e.currentTarget.dataset;
  <button onClick={shared} />;
  <div onInput={shared} />;
  // T4 handler written against React-ish EventTarget signature
  const legacy = (e: { currentTarget: EventTarget | null }) => e.currentTarget;
  <input onInput={legacy} />;
  // T5 provider without for, typo'd prop
  <Provider fallback={<i />} fro={Svc}><p /></Provider>;
  // T6 lowercase contenteditable (native name) typed?
  <div contenteditable={false} />;
  // T7 spellcheck / draggable booleans typed
  <div spellcheck={false} draggable={false} />;
  // T8 provider missing everything
  <Provider><p /></Provider>;
  // T9 capture handler narrowing
  <input onInputCapture={(e) => e.currentTarget.value} />;
});
