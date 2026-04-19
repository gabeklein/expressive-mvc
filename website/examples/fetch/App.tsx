import { Query } from './Query';

// Extending Query gives us all the request bookkeeping for free.
// We just supply `request()` - the actual endpoint-specific work -
// and inherit waiting/error tracking, run, and reset.

class HelloQuery extends Query {
  async request() {
    const res = await fetch('https://randomuser.me/api?nat=us&results=1');
    const { first, last } = (await res.json()).results[0].name;
    return `Hello ${first} ${last}`;
  }
}

// `.use()` creates an instance scoped to App and subscribes us to
// anything we destructure off it. The container/heading wrap whichever
// branch the inner `body()` returns - so the heading stays put no
// matter which state we're in.
const App = () => {
  const { response, error, waiting, reset, run } = HelloQuery.use();

  function body() {
    if (response) return <p>Server said: {response} <button onClick={reset}>Reset</button></p>;
    else if (error) return <p>Error: {error.message} <button onClick={reset}>Reset</button></p>;
    else if (waiting) return <p>Sent! Waiting on response...</p>;
    else return <button onClick={run}>Say hello to server!</button>;
  }

  return (
    <div className="container">
      <h1>Fetch Example</h1>
      {body()}
    </div>
  );
};

export default App;
