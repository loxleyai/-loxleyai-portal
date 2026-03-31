"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/run-agent")
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Railroad Valley Agent</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Score</th>
            <th>Land</th>
            <th>Geo</th>
            <th>Water</th>
          </tr>
        </thead>
        <tbody>
          {data.map(t => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.score.toFixed(2)}</td>
              <td>{t.land}</td>
              <td>{t.geo.toFixed(2)}</td>
              <td>{t.water.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
