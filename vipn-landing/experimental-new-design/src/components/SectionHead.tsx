export function SectionHead({
  index,
  eyebrow,
  title,
  lede,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="section-head" data-reveal>
      <p className="eyebrow">
        {index ? <span className="eyebrow-index">{index}</span> : null}
        {eyebrow}
      </p>
      <h2>{title}</h2>
      <p className="section-lede">{lede}</p>
    </div>
  );
}
