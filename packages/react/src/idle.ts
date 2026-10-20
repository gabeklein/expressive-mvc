interface Dispatcher {
  useContext: unknown;
  useState: unknown;
}

export function idle(React: any): () => boolean {
  const modern = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const legacy = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher;

  const current: (() => Dispatcher | null) | undefined =
    modern && 'H' in modern ? () => modern.H :
    legacy && 'current' in legacy ? () => legacy.current :
    undefined;

  if (!current) return () => false;

  return () => {
    const dispatcher = current();

    return !dispatcher || dispatcher.useContext === dispatcher.useState;
  };
}
