import React from "react";

import { Whatever } from "./extended";

const useWhatever = Whatever.hook();

export const UsingContext = () => {
  const { Provider } = Whatever.use("This example uses providers!")

  return (
    <Provider>
      <InnerText/>
      <InnerButton/>
    </Provider>
  )
}

const InnerText = () => {
  const { value } = useWhatever();

  return <div>{value}</div>
}

const InnerButton = () => {
  const state = useWhatever();

  return (
    <div
      className="clicky"
      onClick={() => {
        state.value = "Somebody pushed the button!"
      }}>
      Don't Touch!
    </div>
  )
}