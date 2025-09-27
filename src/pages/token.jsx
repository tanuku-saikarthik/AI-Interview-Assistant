import React, { useState } from "react";
import { Modal, Input, Button, message } from "antd";

export default function AccessModal({ visible, onConfirm }) {
  const [token, setToken] = useState("");
  const correctToken = import.meta.env.INTERVIEWER_PASSWORD||"interviewer123";
  const handleSubmit = () => {
    if (token === correctToken) {
      onConfirm();
    } else {
      message.error("Invalid access token!");
    }
  };
  return (
    <Modal
      visible={visible}
      title="Enter Interviewer Access Token"
      onCancel={() => message.error("Access denied")}
      footer={null}
      closable={false}
    >
      <Input
        placeholder="Enter token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onPressEnter={handleSubmit}
      />
      <Button type="primary" style={{ marginTop: 12 }} onClick={handleSubmit}>
        Submit
      </Button>
    </Modal>
  );
}
