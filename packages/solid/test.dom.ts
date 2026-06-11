// Bootstraps happy-dom before any other test code runs. Preloaded first by
// bunfig.toml so that `globalThis.document` exists by the time test.setup.ts
// (and its transitive @testing-library/* imports) evaluate. Anything else
// here would defeat the purpose - keep this file just the registration.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
