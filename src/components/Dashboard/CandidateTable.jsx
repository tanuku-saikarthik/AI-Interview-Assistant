import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Card, Table, Input, Space, Button, Modal } from 'antd';
import CandidateDetail from './CandidateDetail';

export default function CandidateTable() {
  const candidates = useSelector(s => s.candidates || []);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const data = candidates
    .map(c => ({ key: c.id, id: c.id, name: c.name || 'Unknown', email: c.email || '', phone: c.phone || '', score: c.score || 0, summary: c.summary || '', createdAt: c.createdAt || '' }))
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Phone', dataIndex: 'phone' },
    { title: 'Score', dataIndex: 'score', sorter: (a,b)=> (a.score||0)-(b.score||0) },
    { title: 'Summary', dataIndex: 'summary', render: v => v ? v.slice(0,80) + '...' : '' },
    { title: 'Actions', render: (_, r) => <Button onClick={() => setSelectedId(r.id)}>View</Button> }
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search placeholder="Search by name or email" onSearch={v => setSearch(v)} enterButton />
        <Button onClick={() => {
          const out = JSON.stringify(candidates || [], null, 2);
          const blob = new Blob([out], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'candidates.json'; a.click();
        }}>Export JSON</Button>
      </Space>

      <Table dataSource={data} columns={columns} />

      <Modal open={!!selectedId} onCancel={() => setSelectedId(null)} footer={null} width={900}>
        {selectedId && <CandidateDetail id={selectedId} />}
      </Modal>
    </Card>
  );
}
