import React from 'react';
import { Modal } from 'antd';

export default function WelcomeBackModal({ visible, onClose, onResume }) {
  return (
    <Modal open={visible} onCancel={onClose} onOk={onResume} okText="Resume Interview">
      <p>We found an unfinished interview session for this candidate. Resume where you left off?</p>
    </Modal>
  );
}
