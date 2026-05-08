export function renderViewerHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Alien Puzzle Garden Viewer</title>
    <link rel="stylesheet" href="/viewer.css">
  </head>
  <body>
    <main class="shell">
      <aside class="left-pane">
        <div class="brand">
          <span class="kicker">Strange Pattern Observatory</span>
          <h1>Alien Puzzle Garden</h1>
        </div>
        <input id="filter" class="filter" type="search" placeholder="Filter artifacts">
        <nav id="artifact-tree" class="artifact-tree" aria-label="Artifact tree"></nav>
      </aside>
      <section class="center-pane">
        <header class="content-header">
          <div>
            <span id="artifact-kind" class="artifact-kind">ready</span>
            <h2 id="artifact-title">Select an artifact</h2>
          </div>
          <code id="artifact-path">experiments/</code>
        </header>
        <article id="content" class="content">
          <p class="empty">Choose a report or JSON artifact from the left pane.</p>
        </article>
      </section>
      <aside class="right-pane">
        <h2>Summary</h2>
        <dl id="summary" class="summary">
          <dt>Status</dt>
          <dd>Waiting for selection</dd>
        </dl>
      </aside>
    </main>
    <script src="/viewer.js" type="module"></script>
  </body>
</html>`;
}
