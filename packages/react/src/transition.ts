import { Runtime } from './runtime';

type Start = (work: () => void) => void;

interface Driver {
  start: Start;
  waiting: (() => void)[];
}

const DRIVERS = new Set<Driver>();

function settle(driver: Driver) {
  for (const resolve of driver.waiting.splice(0)) resolve();
}

/**
 * Bracket `work` through a mounted driver, reporting when React has presented
 * it. Falls back to the ambient scheduler when nothing is mounted to observe -
 * the work still defers, it just reports nothing.
 */
export function drive(work: () => void, ambient: Start): void | Promise<void> {
  const [driver] = DRIVERS;

  if (!driver) return ambient(work);

  return new Promise<void>((resolve) => {
    driver.waiting.push(resolve);
    driver.start(work);
  });
}

/**
 * Hosts the host-side transition scheduler. React reports a transition as
 * pending only through the hook that started it, so an update deferred from
 * outside render needs a mounted hook to schedule through and to observe.
 */
export function useDriver() {
  const hook = Runtime.useTransition;

  if (!hook) return;

  const [pending, start] = hook();
  const ref = Runtime.useRef<Driver | null>(null);
  const driver = ref.current || (ref.current = { start, waiting: [] });

  driver.start = start;

  Runtime.useEffect(() => {
    DRIVERS.add(driver);

    return () => {
      DRIVERS.delete(driver);
      settle(driver);
    };
  }, []);

  Runtime.useEffect(() => {
    if (!pending) settle(driver);
  }, [pending]);
}
