import type { ReactNode } from "react";

export function SearchHighlight({ text, query }: { text: string; query: string }): ReactNode {
  const needle = query.trim();
  if (!needle) return text;

  const start = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (start < 0) return text;

  return (
    <>
      {text.slice(0, start)}
      <mark className="set-search-match">{text.slice(start, start + needle.length)}</mark>
      {text.slice(start + needle.length)}
    </>
  );
}
