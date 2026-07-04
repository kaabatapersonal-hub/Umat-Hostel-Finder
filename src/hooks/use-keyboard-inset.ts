"use client";

import { useEffect, useState } from "react";

// On mobile, an on-screen keyboard shrinks `window.visualViewport`, not the
// layout viewport CSS reads from -- a `position: fixed; bottom: 0` sheet
// stays anchored to the *layout* viewport's bottom edge, which is now
// behind the keyboard. This tracks how much of the layout viewport the
// keyboard is currently covering, so a fixed sheet can shift itself up by
// exactly that amount and keep its inputs (and submit button) visible.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function update() {
      setInset(Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop));
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
