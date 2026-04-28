declare function format(value: unknown): string;

const TONE = {
  ok: {
    container: "border-neutral-800 bg-neutral-950 text-neutral-400",
    label: "text-neutral-600",
    name: "text-neutral-200",
    input: "text-neutral-500",
    body: "text-neutral-300",
  },
  error: {
    container: "border-red-900/60 bg-red-950/30 text-red-300",
    label: "text-red-500/80",
    name: "text-red-200",
    input: "text-red-400/80",
    body: "text-red-200",
  },
};

function ToolCall({
  type,
  state,
  input,
  output,
  errorText,
}: {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}) {
  const isError = state === "output-error";
  const t = isError ? TONE.error : TONE.ok;
  const name = type.replace(/^tool-/, "");
  const bodyLabel = isError ? "error" : "output";
  const bodyValue = isError ? errorText : output;

  return (
    <div className="flex justify-start">
      <div className={`max-w-[80%] rounded-lg border px-3 py-2 font-mono text-xs ${t.container}`}>
        <div>
          <span className={t.label}>tool</span>{" "}
          <span className={t.name}>{name}</span>
          {isError && <span className={`ml-1 ${t.label}`}>(Error)</span>}
        </div>
        {input !== undefined && (
          <ToolData label="input" value={input} className={t.input} labelTone={t.label} />
        )}
        {bodyValue !== undefined && (
          <ToolData label={bodyLabel} value={bodyValue} className={t.body} labelTone={t.label} />
        )}
      </div>
    </div>
  );
}

function ToolData({
  label,
  value,
  className,
  labelTone = "text-neutral-600",
}: {
  label: string;
  value: unknown;
  className: string;
  labelTone?: string;
}) {
  return (
    <div className="mt-1.5">
      <div className={`text-[10px] uppercase tracking-wide ${labelTone}`}>
        {label}
      </div>
      <pre className={`whitespace-pre-wrap break-words mx-2 my-1 ${className}`}>
        {format(value)}
      </pre>
    </div>
  );
}