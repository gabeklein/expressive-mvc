import { Link } from 'react-router';

const HOOK_ROWS = [
  [
    'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef',
    'useContext', 'useReducer', 'useLayoutEffect', 'useId', 'useTransition',
  ],
  [
    'useSWR', 'useQuery', 'useMutation', 'useInfiniteQuery', 'useForm',
    'useFieldArray', 'useController', 'useStore', 'useSelector', 'useDispatch',
  ],
  [
    'useDeferredValue', 'useSyncExternalStore', 'useImperativeHandle',
    'useOptimistic', 'useActionState', 'useFormStatus', 'useMediaQuery',
    'useDebounce', 'useVirtualizer', 'useLocalStorage',
  ],
];

export function Hero() {
  return (
    <section className="border-b border-fd-border flex flex-col items-center justify-center gap-10 px-6 py-24 min-h-[calc(100vh-56px)]">
      <div className="w-full max-w-5xl text-center">
        <div className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-none">
          React has
        </div>

        <div className="my-6 flex flex-col gap-3">
          {HOOK_ROWS.map((row, i) => (
            <PillRow key={i} pills={row} reverse={i % 2 === 1} speed={34 + i * 6} />
          ))}
        </div>

        <div className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-none">
          gotten complicated<span className="text-fd-primary">.</span>
        </div>
      </div>

      <div className="w-full max-w-3xl text-center">
        <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-5">
          Give state its own Component.
        </h1>
        <p className="text-lg md:text-xl text-fd-muted-foreground max-w-2xl mx-auto mb-8">
          Expressive MVC moves state, async, and lifecycle out of your components
          and into plain classes. No setters, no dependency arrays, no prop
          drilling. Components go back to describing UI.
        </p>
        <HeroNavigation />
        <div className="mt-10 inline-block font-mono text-sm bg-fd-muted py-3 px-5 rounded-lg text-fd-muted-foreground">
          npm install @expressive/react
        </div>
      </div>
    </section>
  );
}

const linkClass =
  'inline-flex items-center justify-center rounded-full font-medium py-3 px-6 no-underline transition-[opacity,background-color] duration-200';

function HeroNavigation() {
  return (
    <div className="flex flex-col gap-3 justify-center sm:flex-row">
      <Link
        className={`${linkClass} bg-fd-primary text-fd-primary-foreground hover:opacity-90`}
        to="/docs/getting-started">
        Get Started
      </Link>
      <Link
        className={`${linkClass} border border-fd-border text-inherit hover:bg-fd-muted`}
        to="/examples">
        Playground
      </Link>
    </div>
  );
}

function PillRow({ pills, reverse, speed }: { pills: string[]; reverse?: boolean; speed: number }) {
  const animation = `${reverse ? 'marquee-x-reverse' : 'marquee-x'} ${speed}s linear infinite`;

  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="marquee-track flex w-max gap-3" style={{ animation }}>
        {[...pills, ...pills].map((name, i) => (
          <span
            key={i}
            className="shrink-0 rounded-full border border-fd-border bg-fd-muted/40 font-mono text-sm text-fd-muted-foreground py-1.5 px-3.5">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
