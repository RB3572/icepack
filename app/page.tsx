export default function Home() {
  return (
    <main className="site-shell">
      <nav className="nav" aria-label="Primary navigation"><a className="wordmark" href="#top">newer<span>pack</span></a><a className="nav-link" href="#collection">Collection</a></nav>
      <section className="hero" id="top"><p className="eyebrow">A growing project archive</p><h1>Good work deserves a place to gather.</h1><p className="intro">Newerpack is a quiet home for experiments, notes, and useful things in progress.</p><a className="primary-link" href="#collection">Browse the collection <span aria-hidden="true">↓</span></a></section>
      <section className="collection" id="collection" aria-labelledby="collection-title"><div className="section-heading"><p className="eyebrow">Current index</p><h2 id="collection-title">On the shelf</h2></div><div className="entries"><article className="entry entry-featured"><p className="entry-number">01</p><div><p className="entry-type">Field notes</p><h3>Experiments that taught us something</h3></div><span className="entry-arrow" aria-hidden="true">↗</span></article><article className="entry"><p className="entry-number">02</p><div><p className="entry-type">Working collection</p><h3>Tools for seeing clearly</h3></div><span className="entry-arrow" aria-hidden="true">↗</span></article><article className="entry"><p className="entry-number">03</p><div><p className="entry-type">Open file</p><h3>Ideas still finding their form</h3></div><span className="entry-arrow" aria-hidden="true">↗</span></article></div></section>
      <footer><span>Newerpack</span><span>Built to change.</span></footer>
    </main>
  );
}
