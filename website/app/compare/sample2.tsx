declare function format(value: unknown): string;

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
  const name = type.replace(/^tool-/, "");
  const bodyLabel = isError ? "error" : "output";
  const bodyValue = isError ? errorText : output;

  $containerBg: 0x0a0a0a;
  $containerBorder: 0x262626;
  $containerColor: 0xa3a3a3;
  $tagColor: 0x525252;
  $nameColor: 0xe5e5e5;
  $inputColor: 0x737373;
  $bodyColor: 0xd4d4d4;

  if (isError) {
    $containerBg: 0x450a0a4d;
    $containerBorder: 0x7f1d1d99;
    $containerColor: 0xfca5a5;
    $tagColor: 0xef4444cc;
    $nameColor: 0xfecaca;
    $inputColor: 0xf87171cc;
    $bodyColor: 0xfecaca;
  }

  display: flex;
  justifyContent: flexStart;

  container: {
    maxWidth: "80%";
    borderRadius: 8;
    border: 1, solid;
    borderColor: $containerBorder;
    background: $containerBg;
    color: $containerColor;
    padding: 8, 12;
    fontFamily: "ui-monospace, SFMono-Regular, monospace";
    fontSize: "0.75rem";
  }

  tag: {
    color: $tagColor;
  }

  name: {
    color: $nameColor;
  }

  errorTag: {
    marginLeft: 4;
  }

  output: {
    marginTop: 6;

    tag: {
      fontSize: "10px";
      textTransform: uppercase;
      letterSpacing: "0.025em";
      color: $tagColor;
    }

    pre: {
      whiteSpace: "pre-wrap";
      wordBreak: "break-word";
      margin: 4, 8;
      color: $inputColor;

      if(bodyValue !== undefined)
        color: $bodyColor;
    }

  }

  return (
    <div>
      <div _container>
        <div>
          <span _tag>tool</span>{" "}
          <span _name>{name}</span>
          {isError && <span _tag _errorTag>(Error)</span>}
        </div>
        {input !== undefined && (
          <div _output>
            <div _tag>input</div>
            <pre>{format(input)}</pre>
          </div>
        )}
        {bodyValue !== undefined && (
          <div _output>
            <div _tag>{bodyLabel}</div>
            <pre>{format(bodyValue)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}