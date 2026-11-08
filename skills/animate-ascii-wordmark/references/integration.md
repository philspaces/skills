# Integration

Read this when placing a generated wordmark into a site, component, or README. The generated `index.html` is the simplest working example. Copy its local assets and retain the font license notices.

## Standalone website

Serve the generated folder as a static site. Its browser module and fonts are local; no React or external font service is required. Keep the canvas responsive with a stable aspect ratio and a transparent background. Give the wordmark an accessible text equivalent, such as `role="img"` and `aria-label="Skills"` on its canvas.

When embedding only the animation, import the generated browser module and call:

```js
import { mountWordmark } from './assets/wordmark.mjs';

const controller = await mountWordmark(canvas, {
  text: 'Skills',
  theme: 'dark',
  seed: 71339,
});

// When the element is removed:
controller.destroy();
```

Keep the runtime's reduced-motion handling. Do not start a second animation loop around an automatically mounted wordmark. For manual rendering or capture, pass `{ manual: true }` as the third argument and use the controller's `step()`, `snapshot()`, and `render()` methods. `render({ static: true })` renders the stable silhouette.

## React

Use the browser runtime inside an effect after the canvas exists. Destroy the controller on unmount and after prop changes. Initialization is asynchronous, so also destroy a controller that resolves after cleanup:

```jsx
import { useEffect, useRef } from 'react';
import { mountWordmark } from './assets/wordmark.mjs';

export function AsciiWordmark({ text, theme = 'dark', seed = 71339 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let controller;

    mountWordmark(canvasRef.current, { text, theme, seed }).then((instance) => {
      if (disposed) instance.destroy();
      else controller = instance;
    });

    return () => {
      disposed = true;
      controller?.destroy();
    };
  }, [text, theme, seed]);

  return <canvas ref={canvasRef} role="img" aria-label={text} />;
}
```

Use the generated preview's sizing styles. Handle initialization failures in the host application's existing error UI, or replace the canvas with the matching static PNG.

## GitHub README

Copy the exported media into the repository, for example under `assets/wordmark/`. Use relative paths so forks retain the images. A `<picture>` can select dark/light output and a static image for reduced motion:

```html
<picture>
  <source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="assets/wordmark/wordmark-dark-static.png">
  <source media="(prefers-reduced-motion: reduce)" srcset="assets/wordmark/wordmark-light-static.png">
  <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark/wordmark-dark.gif">
  <source media="(prefers-color-scheme: light)" srcset="assets/wordmark/wordmark-light.gif">
  <img alt="Skills" src="assets/wordmark/wordmark-light-static.png" width="820">
</picture>
```

Replace the alt text and paths for the actual wordmark. Verify the rendered README in both themes. The standalone GIF cannot react to motion preferences; the surrounding markup provides the static choice. Use the static PNG directly wherever the host does not support that markup.
