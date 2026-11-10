import type { Component } from "@expressive/mvc";

import Docs from "../index";
import { H2 } from "../components";
import { style } from "../../style";

function Member(props: { id?: string; children?: Component.Node }) {
  return (
    <div data-api _member>
      <H2 {...props} />
    </div>
  );
}

style(Member, $ => ({
  _member: { borderInlineStart: ["3px", "solid", $.accent], paddingInlineStart: 12, marginTop: 40 },
}));

export default class Api extends Docs {
  h2 = Member;
}
