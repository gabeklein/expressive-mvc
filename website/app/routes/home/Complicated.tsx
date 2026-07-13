import Reveal from '@/components/Reveal';

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

export function Complicated() {
  return (
    <section className="overflow-hidden">
      <div className="mx-auto max-w-4xl px-6 pt-12 text-center md:pt-20">
        <Reveal>
          <h2 className="font-display whitespace-nowrap text-[clamp(1.4rem,6vw,3rem)] font-bold tracking-tight leading-none">
            React has gotten complicated<span className="text-fd-primary">.</span>
          </h2>
        </Reveal>
      </div>

      <div className="my-6 py-5 md:my-10 md:py-8 bg-fd-foreground/[0.04] flex flex-col gap-3 md:gap-4">
        {HOOK_ROWS.map((row, i) => (
          <PillRow key={i} pills={row} reverse={i % 2 === 1} speed={34 + i * 6} />
        ))}
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-12 md:pb-20">
        <Reveal className="max-w-2xl mx-auto text-center">
          <p className="text-fd-muted-foreground text-lg leading-relaxed">
            Hooks accumulate with features. Their logic stays tied to React.
            Wiring them makes components larger, tightly coupled, and difficult to trace.
          </p>
        </Reveal>
      </div>
    </section>
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
            className="shrink-0 rounded-full border border-fd-border bg-fd-background/60 font-mono text-sm text-fd-muted-foreground py-1.5 px-3.5">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
