import { useEffect, useState } from "react";

function Tree({ node }) {
  return (
    <ul>
      {Object.entries(node).map(([name, value]) => (
        <li key={name}>
          {value.__file ? (
            <span>📄 {name}</span>
          ) : (
            <details>
              <summary>📁 {name}</summary>
              <Tree node={value} />
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function MyArchive() {
  const [tree, setTree] = useState(null);

  useEffect(() => {
    const id = prompt("Enter Archive Identifier");
    if (!id) return;

    fetch(
      process.env.NEXT_PUBLIC_API + `/api/tree/${id}`
    )
      .then(r => r.json())
      .then(setTree);
  }, []);

  return (
    <div className="container">
      <h2>My Archive</h2>
      {tree ? <Tree node={tree} /> : <p>Loading…</p>}
    </div>
  );
}
