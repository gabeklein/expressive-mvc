import React, { Fragment } from "react";

export const Wrapper = ({ children }) => (
  <Fragment>
    <Style />
    <div id="container">
      {children}
    </div>
  </Fragment>
)

const Style = () => (
  <style>{`
    body {
      margin: 0;
      padding: 0;
      color: #567ecc;
      font-size: 60px;
    }
    #container {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .clicky {
      padding: .2em .4em;
      border-radius: .2em;
      background: #eee;
      cursor: pointer;
      user-select: none;
      text-align: middle;
    }
  `}</style>
)