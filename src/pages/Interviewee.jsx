import React, { useEffect } from "react";
import { Card } from "antd";
import ResumeUploader from "../components/Chat/ResumeUploader";
import ChatBox from "../components/Chat/ChatBox";
export default function Interviewee() {
  return (
    <div className="container">
      <Card className="resume-card">
        <ResumeUploader />
      </Card>
      <ChatBox />
    </div>
  );
}
