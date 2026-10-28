import { render } from '@expressive/dom';
import { Session } from './session';
import { connectWs, type Boot } from './socket';
import { App } from './views';

const boot = (globalThis as { __EXPRESSIVE_DEVTOOLS__?: Boot }).__EXPRESSIVE_DEVTOOLS__ ?? {};

const session = Session.new();
const connection = connectWs(boot);
void session.open(connection);

render(<App />, document.body);
