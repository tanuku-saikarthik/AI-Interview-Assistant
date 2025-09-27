import React, { useEffect, useState } from "react";
import { Descriptions, List, Divider } from "antd";
export default function CandidateDetail({ id }) {
  const [candidate, setCandidate] = useState(null);
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("persist:root") || "{}");
    try {
      const parsedRoot = Object.keys(stored).length ? stored : null;
      if (parsedRoot && parsedRoot.candidates) {
        const candidatesJson = JSON.parse(parsedRoot.candidates);
        const c = candidatesJson.find((x) => x.id === id);
        setCandidate(c);
      } else {
        const raw = localStorage.getItem("candidates");
        if (raw) {
          const arr = JSON.parse(raw);
          setCandidate(arr.find((x) => x.id === id));
        }
      }
    } catch (e) {
      const raw = localStorage.getItem("candidates");
      if (raw) {
        const arr = JSON.parse(raw);
        setCandidate(arr.find((x) => x.id === id));
      }
    }
  }, [id]);
  if (!candidate) return <div>Loading...</div>;
  return (
    <div>
      <Descriptions
        title={`${candidate.name || __STRING_0_6__} — Details`}
        bordered
        column={1}
      >
        <Descriptions.Item label="Email">{candidate.email}</Descriptions.Item>
        <Descriptions.Item label="Phone">{candidate.phone}</Descriptions.Item>
        <Descriptions.Item label="Score">
          {candidate.score || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Summary">
          {candidate.summary || "—"}
        </Descriptions.Item>
      </Descriptions>
      <Divider />
      <h3>Q/A</h3>
      <List
        dataSource={candidate.qas || []}
        renderItem={(item, idx) => (
          <List.Item>
            <List.Item.Meta
              title={`Q${idx + 1} (${item.difficulty})`}
              description={
                <div>
                  <div style={{ fontWeight: 600 }}>{item.question}</div>
                  <div>{item.answer || "<no answer>"}</div>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
}
