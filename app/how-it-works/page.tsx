import '../site.css'

const steps = [
  ['01', 'Received', 'WhatsApp, Outlook, or the Reporter app enters one desk inbox.'],
  ['02', 'Matched', 'The slug, district, and reporter footage stay attached to the same story.'],
  ['03', 'Reviewed', 'The editor can edit, reject, or approve without touching the source footage.'],
  ['04', 'Fed', 'Approved stories reach Octopus only after a person on the desk says go.'],
]

export default function HowItWorks() {
  return <main className="site"><nav className="site-nav"><a href="/">VARTMAAN AI</a><div className="site-nav__links"><a href="/how-it-works">How it works</a><a href="/proof">Proof</a><a href="/contact">Contact</a></div></nav><div className="site-wrap"><p className="site-kicker">One story, kept intact</p><h1>How a reporter&apos;s story reaches the desk with its footage.</h1><p className="site-lede">A decision tree for the assignment desk: what arrives, what Vartmaan matches, and where a human editor takes over.</p><section className="tree">{steps.map(([no,title,copy]) => <article className="tree-card" key={no}><span className="tree-no">{no}</span><h2>{title}</h2><p>{copy}</p></article>)}</section><footer className="site-footer"><span>VARTMAAN AI / ASSIGNMENT DESK</span><a href="/">Back to the edition</a></footer></div></main>
}
