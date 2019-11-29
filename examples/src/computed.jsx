
import { use } from 'react-use-controller';
import React from "react";

class Counter {
  seconds = 0;

  didMount(){
    setInterval(() => {
      this.seconds += 30;
      console.log(this.seconds)
    }, 1000)
  }

  get minutes(){
    return Math.floor(this.seconds / 60)
  }
}

export const Computed = () => {
  const { minutes } = use(Counter);

  console.log(minutes)

  return (
    <div className="clicky">
      {minutes}
    </div>
  )
}