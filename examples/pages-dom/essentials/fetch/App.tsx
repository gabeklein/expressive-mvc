/** @jsxImportSource @expressive/dom */
import './App.css';

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

const Example = () => {
  // `.use()` creates an instance scoped to App.
  // Destructuring subscribes us to those fields.
  const { response, error, waiting, reset, run } = HelloQuery.use();

  if (response) 
    return (
      <p class="fetch-result">
        <span>Server said: {response}</span>
        <button onClick={reset}>Reset</button>
      </p>
    )

  if (error) 
    return (
      <p class="fetch-result">
        <span>Error: {error.message}</span>
        <button onClick={reset}>Reset</button>
      </p>
    )

  if (waiting) 
    return <p class="fetch-status">Sent. Waiting on response...</p>

  return (
    <button class="fetch-action" onClick={run}>Say hello to server</button>
  )
};

export default () => (
  <div class="container">
    <h1>Fetch Example</h1>
    <Example />
  </div>
);
