/**
 * Simple generated illustration by place group (DESIGN.md §5.3). TAT data has no photos,
 * so cards use this and say it's an illustration, not a real picture.
 */
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function CategoryArt({
  group,
  seed,
  color,
}: {
  group: string;
  seed: string;
  color: string;
}) {
  const h = hash(seed);
  const r = (n: number) => ((h >> (n * 3)) % 100) / 100;
  let shapes: React.ReactNode;

  if (group === "sea" || group === "spa") {
    shapes = [0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M0 ${58 + i * 14} q25 -9 50 0 t50 0 t50 0 t50 0 V100 H0Z`}
        fill={color}
        opacity={0.22 + i * 0.2}
      />
    ));
  } else if (group === "mountain" || group === "nature" || group === "view") {
    const a = 30 + r(1) * 18;
    const b = 18 + r(2) * 16;
    shapes = (
      <>
        <path
          d={`M0 100 L${30 + r(3) * 14} ${a} L${58 + r(4) * 10} 100Z`}
          fill={color}
          opacity={0.45}
        />
        <path
          d={`M${38 + r(5) * 10} 100 L${75 + r(6) * 14} ${b} L130 100Z`}
          fill={color}
          opacity={0.7}
        />
        {group === "view" && (
          <circle cx={112 + r(7) * 14} cy={26 + r(8) * 10} r={11} fill="#fff" opacity={0.55} />
        )}
      </>
    );
  } else if (group === "temple" || group === "history") {
    const x = 64 + r(1) * 12;
    shapes = (
      <>
        <path d={`M${x} 14 L${x + 27} 58 H${x - 27}Z`} fill={color} opacity={0.8} />
        <rect x={x - 20} y={58} width={40} height={42} fill={color} opacity={0.5} />
        <rect x={x - 4} y={74} width={8} height={26} fill="#fff" opacity={0.6} />
      </>
    );
  } else {
    shapes = (
      <>
        <circle
          cx={40 + r(1) * 30}
          cy={50 + r(2) * 20}
          r={26 + r(3) * 10}
          fill={color}
          opacity={0.45}
        />
        <circle
          cx={90 + r(4) * 30}
          cy={40 + r(5) * 25}
          r={18 + r(6) * 10}
          fill={color}
          opacity={0.7}
        />
      </>
    );
  }

  return (
    <svg
      viewBox="0 0 160 100"
      preserveAspectRatio="xMidYMid slice"
      className="block size-full"
      aria-hidden="true"
    >
      <rect width="160" height="100" fill={color} opacity={0.12} />
      {shapes}
    </svg>
  );
}
