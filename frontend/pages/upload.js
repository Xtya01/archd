import { useEffect, useState } from "react";

export default function Upload() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const es = new EventSource(
      process.env.NEXT_PUBLIC_API + "/api/events"
    );
    es.onmessage = e => {
      setEvents(prev => [...prev, JSON.parse(e.data)]);
    };
    return () => es.close();
  }, []);

  async function uploadFile(e) {
    e.preventDefault();
    const form = new FormData(e.target);

    await fetch(
      process.env.NEXT_PUBLIC_API + "/api/upload",
      { method: "POST", body: form }
    );
  }

  async function uploadUrl(e) {
    e.preventDefault();
    const url = e.target.url.value;

    await fetch(
      process.env.NEXT_PUBLIC_API + "/api/upload-url",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      }
    );
  }

  return (
    <div className="container">
      <h2>Upload</h2>

      <form onSubmit={uploadFile}>
        <input type="file" name="file" />
        <button>Add File</button>
      </form>

      <form onSubmit={uploadUrl}>
        <input
          name="url"
          placeholder="https://example.com/file.iso"
        />
        <button>Add URL</button>
      </form>

      <h3>Queue</h3>
      <ul>
        {events.map((e, i) => (
          <li key={i}>
            {e.name} → {e.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
