export function Steps({ current }: { current: 1 | 2 }) {
  const steps = ["Your details", "College ID"];
  return (
    <ol className="mb-6 flex gap-2 text-xs font-medium">
      {steps.map((s, i) => (
        <li
          key={s}
          className={`flex-1 rounded-full px-3 py-1.5 text-center ${
            i + 1 === current ? "bg-stone-900 text-white" : i + 1 < current ? "bg-stone-300 text-stone-800" : "bg-stone-200 text-stone-500"
          }`}
        >
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  );
}
