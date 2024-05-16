/** @jsxImportSource @expressive/preact */

import { VNode, JSX } from "preact"

declare const Thing: (props: { foo: "bar" }) => VNode;

const Something = () => (
  <Thing foo="bar" lol="something" />
)