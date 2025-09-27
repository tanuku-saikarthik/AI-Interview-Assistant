import React, { useEffect } from "react";
export default function QuestionTimer({ seconds, onTick }) {
  useEffect(() => {
    let t;
    if (seconds > 0) {
      t = setTimeout(() => onTick(seconds - 1), 1000);
    } else {
      onTick(0);
    }
    return () => clearTimeout(t);
  }, [seconds]);
  return <span style={{ fontWeight: 700 }}>Time left: {seconds}s</span>;
}
